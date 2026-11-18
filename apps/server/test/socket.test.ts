import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ChatMessage,
  ClientToServerEvents,
  Notification,
  ServerToClientEvents,
} from "@chatty/shared";
import request from "supertest";
import { NotificationModel } from "../src/models/notification.model";
import { UserModel } from "../src/models/user.model";
import { signSessionToken, signSocketToken } from "../src/lib/tokens";
import { RoomModel } from "../src/models/room.model";
import { createSocketServer, socketPresence, type ChatServer } from "../src/socket";
import { app, env, loginAs, seedRoom, seedUser, TEST_ROOM_PASSWORD } from "./helpers";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type AckResponse<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

let httpServer: HttpServer;
let io: ChatServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  httpServer = createServer(app);
  io = createSocketServer(env, httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  await Promise.all([seedUser("tanner"), seedUser("ben")]);
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.disconnect());
  await io.close();
});

function client(token: string): Client {
  const socket: Client = connect(url, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

const tokenFor = (username: string) => signSocketToken(env.JWT_SECRET, { sub: "id", username });

async function connected(username: string): Promise<Client> {
  const socket = client(tokenFor(username));
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}

function connectError(token: string): Promise<string> {
  return new Promise((resolve) =>
    client(token).once("connect_error", (err) => resolve(err.message)),
  );
}

const join = (socket: Client, room: number) =>
  new Promise<AckResponse>((resolve) => socket.emit("join_room", { room }, resolve));

const send = (socket: Client, room: number, message: string) =>
  new Promise<AckResponse<ChatMessage>>((resolve) =>
    socket.emit("send_message", { room, message }, resolve),
  );

describe("socket authentication", () => {
  it("rejects connections without a valid socket token", async () => {
    expect(await connectError("")).toBe("unauthorized");
    expect(await connectError("garbage")).toBe("unauthorized");
    // A session token must not work as a socket token.
    const session = signSessionToken(env.JWT_SECRET, { sub: "id", username: "tanner" });
    expect(await connectError(session)).toBe("unauthorized");
  });
});

describe("chat events", () => {
  it("delivers a message to others in the room and stores it under the token's username", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    expect(await join(tanner, 1)).toEqual({ ok: true });
    expect(await join(ben, 1)).toEqual({ ok: true });

    const received = new Promise<{ room: number; message: ChatMessage }>((resolve) =>
      ben.once("receive_message", resolve),
    );
    const ack = await send(tanner, 1, "  hi ben  ");

    expect(ack.ok).toBe(true);
    const { room, message } = await received;
    expect(room).toBe(1);
    expect(message).toMatchObject({ message: "hi ben", sentBy: "tanner" });
    expect(new Date(message.timestamp).toISOString()).toBe(message.timestamp);

    const stored = await RoomModel.findOne({ room_number: 1 });
    expect(stored?.messageHistory.at(-1)).toMatchObject({ message: "hi ben", sentBy: "tanner" });
    expect(stored?.users_in_room).toEqual(expect.arrayContaining(["tanner", "ben"]));
  });

  it("won't let a user join a private room they haven't unlocked", async () => {
    await seedRoom({
      room_number: 9,
      created_by: "ben",
      private_room: true,
      password: TEST_ROOM_PASSWORD,
    });
    const tanner = await connected("tanner");
    expect(await join(tanner, 9)).toEqual({ ok: false, error: "This room is private" });
    expect(await send(tanner, 9, "sneaky")).toEqual({
      ok: false,
      error: "Join the room before sending messages",
    });
    const stored = await RoomModel.findOne({ room_number: 9 });
    expect(stored?.messageHistory).toHaveLength(1);
  });

  it("rejects empty or invalid payloads", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tanner = await connected("tanner");
    await join(tanner, 1);
    expect((await send(tanner, 1, "   ")).ok).toBe(false);
    expect((await send(tanner, 1, "x".repeat(501))).ok).toBe(false);
    expect(await join(tanner, -1)).toMatchObject({ ok: false });
  });

  it("relays typing to others in the room", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);
    const typing = new Promise((resolve) => ben.once("sender_is_typing", resolve));
    tanner.emit("typing", { room: 1 });
    expect(await typing).toEqual({ room: 1, username: "tanner" });
  });
});

describe("socketPresence", () => {
  it("counts distinct users with each room open", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    await seedRoom({ room_number: 2, created_by: "tanner" });
    // tanner has two tabs in room 1; ben has it open once.
    const [tab1, tab2, ben] = await Promise.all([
      connected("tanner"),
      connected("tanner"),
      connected("ben"),
    ]);
    await Promise.all([join(tab1, 1), join(tab2, 1), join(ben, 1)]);

    const counts = socketPresence(io).onlineCounts([1, 2]);
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBeUndefined();
  });
});

describe("mentions", () => {
  const nextNotification = (socket: Client) =>
    new Promise<Notification>((resolve) => socket.once("notification", resolve));

  it("notifies mentioned users live, on every tab, and stores who was mentioned", async () => {
    await seedUser("cara");
    await seedRoom({ room_number: 1, created_by: "tanner", room_name: "Pub" });
    const [tanner, benTab1, benTab2] = await Promise.all([
      connected("tanner"),
      connected("ben"),
      connected("ben"),
    ]);
    await join(tanner, 1);

    const live = Promise.all([nextNotification(benTab1), nextNotification(benTab2)]);
    const ack = await send(tanner, 1, "hey @Ben and @ghost and @tanner, look");
    expect(ack.ok && ack.data.mentions).toEqual(["ben"]);

    const [n1, n2] = await live;
    expect(n1).toMatchObject({
      type: "mention",
      room: 1,
      roomName: "Pub",
      sentBy: "tanner",
      read: false,
    });
    expect(n1.messageId).toBe(ack.ok && ack.data._id);
    expect(n1.preview).toBe("hey @Ben and @ghost and @tanner, look");
    expect(n2._id).toBe(n1._id);
    expect(await NotificationModel.countDocuments()).toBe(1);
  });

  it("doesn't notify people who can't see a private room", async () => {
    await seedUser("cara");
    await seedRoom({
      room_number: 9,
      created_by: "tanner",
      private_room: true,
      password: TEST_ROOM_PASSWORD,
    });
    await UserModel.updateOne({ username: "cara" }, { $push: { roomsJoined: { room: 9 } } });
    const tanner = await connected("tanner");
    await join(tanner, 9);

    const ack = await send(tanner, 9, "@ben @cara secret plans");
    expect(ack.ok && ack.data.mentions).toEqual(["cara"]);
    expect(await NotificationModel.find().distinct("recipient")).toEqual(["cara"]);
  });

  it("lists notifications newest first and marks them read", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tanner = await connected("tanner");
    await join(tanner, 1);
    await send(tanner, 1, "first @ben");
    await send(tanner, 1, "second @ben");

    const ben = await loginAs("ben");
    const list = await ben.get("/api/notifications").expect(200);
    expect(list.body.unreadCount).toBe(2);
    expect(list.body.notifications.map((n: Notification) => n.preview)).toEqual([
      "second @ben",
      "first @ben",
    ]);

    // Someone else can't mark ben's notifications read.
    const other = await loginAs("tanner");
    await other
      .post("/api/notifications/read")
      .send({ ids: [list.body.notifications[0]._id] })
      .expect(204);
    expect((await ben.get("/api/notifications")).body.unreadCount).toBe(2);

    await ben
      .post("/api/notifications/read")
      .send({ ids: [list.body.notifications[0]._id] })
      .expect(204);
    expect((await ben.get("/api/notifications")).body.unreadCount).toBe(1);
    await ben.post("/api/notifications/read").send({}).expect(204);
    expect((await ben.get("/api/notifications")).body.unreadCount).toBe(0);
    await ben
      .post("/api/notifications/read")
      .send({ ids: ["nope"] })
      .expect(400);
    await request(app).get("/api/notifications").expect(401);
  });
});

describe("hide_link_preview", () => {
  const hide = (socket: Client, room: number, messageId: string) =>
    new Promise<AckResponse>((resolve) =>
      socket.emit("hide_link_preview", { room, messageId }, resolve),
    );

  it("lets only the sender hide a preview, for everyone", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);
    const ack = await send(tanner, 1, "look https://example.com");
    const messageId = ack.ok ? ack.data._id! : "";

    expect(await hide(ben, 1, messageId)).toEqual({
      ok: false,
      error: "You can only hide previews on your own messages",
    });

    const updated = new Promise((resolve) => ben.once("message_updated", resolve));
    expect(await hide(tanner, 1, messageId)).toEqual({ ok: true });
    expect(await updated).toEqual({ room: 1, messageId, linkPreviewHidden: true });
    const history = (await (await loginAs("ben")).get("/api/rooms/1")).body.messageHistory;
    expect(history.at(-1)).toMatchObject({ _id: messageId, linkPreviewHidden: true });
  });
});
