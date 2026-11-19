import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MESSAGE_MAX_LENGTH,
  type ChatMessage,
  type ClientToServerEvents,
  type MentionNotification,
  type ServerToClientEvents,
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
const removedPhotos: string[] = [];
const fakeImages = {
  upload: async () => ({ url: "", cloudinary_id: "" }),
  remove: async (ids: string[]) => {
    removedPhotos.push(...ids);
  },
};
const photo = (id: string) => ({
  url: `https://res.cloudinary.com/dezclgtpg/image/upload/v1/chat_images/${id}.png`,
  cloudinary_id: `chat_images/${id}`,
  width: 800,
  height: 600,
});

beforeEach(async () => {
  httpServer = createServer(app);
  removedPhotos.length = 0;
  io = createSocketServer(env, httpServer, fakeImages);
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
    expect((await send(tanner, 1, "x".repeat(MESSAGE_MAX_LENGTH + 1))).ok).toBe(false);
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
    new Promise<MentionNotification>((resolve) =>
      socket.once("notification", (n) => resolve(n as MentionNotification)),
    );

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

  it("ignores mentions inside code and accepts long code messages", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tanner = await connected("tanner");
    await join(tanner, 1);
    const code = "```ts\n" + "const who = '@ben';\n".repeat(150) + "```";
    expect(code.length).toBeGreaterThan(500);
    const ack = await send(tanner, 1, code);
    expect(ack.ok && ack.data.mentions).toBeUndefined();
    expect(await NotificationModel.countDocuments()).toBe(0);
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
    expect(list.body.notifications.map((n: MentionNotification) => n.preview)).toEqual([
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

describe("delete_message", () => {
  const remove = (socket: Client, room: number, messageId: string) =>
    new Promise<AckResponse>((resolve) =>
      socket.emit("delete_message", { room, messageId }, resolve),
    );

  it("lets only the sender delete, removes it for everyone, and clears its notifications", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);
    const ack = await send(tanner, 1, "oops @ben wrong room");
    const messageId = ack.ok ? ack.data._id! : "";
    expect(await NotificationModel.countDocuments({ messageId })).toBe(1);

    expect(await remove(ben, 1, messageId)).toEqual({
      ok: false,
      error: "You can only delete your own messages",
    });

    const deleted = new Promise((resolve) => ben.once("message_deleted", resolve));
    const changed = new Promise((resolve) =>
      ben.once("notifications_changed", () => resolve(true)),
    );
    expect(await remove(tanner, 1, messageId)).toEqual({ ok: true });
    expect(await deleted).toEqual({ room: 1, messageId });
    expect(await changed).toBe(true);

    const room = await RoomModel.findOne({ room_number: 1 });
    expect(room?.messageHistory.some((m) => m._id?.toString() === messageId)).toBe(false);
    expect(await NotificationModel.countDocuments({ messageId })).toBe(0);
  });

  it("refuses unknown ids and rooms you can't see", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    await seedRoom({
      room_number: 9,
      created_by: "ben",
      private_room: true,
      password: TEST_ROOM_PASSWORD,
    });
    const tanner = await connected("tanner");
    expect((await remove(tanner, 1, "0".repeat(24))).ok).toBe(false);
    expect(await remove(tanner, 9, "0".repeat(24))).toEqual({
      ok: false,
      error: "This room is private",
    });
    expect((await remove(tanner, 1, "not-an-id")).ok).toBe(false);
  });
});

describe("photo messages", () => {
  const sendPhotos = (socket: Client, room: number, message: string, attachments: unknown[]) =>
    new Promise<AckResponse<ChatMessage>>((resolve) =>
      socket.emit("send_message", { room, message, attachments } as never, resolve),
    );

  it("sends photos with or without text, and refuses outside images", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);

    const received = new Promise<{ message: ChatMessage }>((resolve) =>
      ben.once("receive_message", resolve),
    );
    const ack = await sendPhotos(tanner, 1, "", [photo("a"), photo("b")]);
    expect(ack.ok && ack.data.attachments).toEqual([photo("a"), photo("b")]);
    expect((await received).message.attachments).toHaveLength(2);

    const outside = { ...photo("x"), url: "https://evil.example/pixel.png" };
    expect(await sendPhotos(tanner, 1, "hi", [outside])).toEqual({
      ok: false,
      error: "Photos must be uploaded through Chatty Chatter",
    });
    const otherFolder = {
      url: "https://res.cloudinary.com/dezclgtpg/image/upload/v1/profile_photos/me.png",
      cloudinary_id: "profile_photos/me",
    };
    expect((await sendPhotos(tanner, 1, "hi", [otherFolder])).ok).toBe(false);
    expect((await sendPhotos(tanner, 1, "", [])).ok).toBe(false);
    expect(
      (
        await sendPhotos(
          tanner,
          1,
          "",
          Array.from({ length: 5 }, (_, i) => photo(`p${i}`)),
        )
      ).ok,
    ).toBe(false);

    const history = (await (await loginAs("ben")).get("/api/rooms/1")).body.messageHistory;
    expect(history.at(-1).attachments).toEqual([photo("a"), photo("b")]);
    const discover = (await (await loginAs("ben")).get("/api/rooms/discover")).body;
    expect(discover[0].lastMessage).toEqual({ message: "📷 Photo", sentBy: "tanner" });
  });

  it("removes a deleted message's photos from storage", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tanner = await connected("tanner");
    await join(tanner, 1);
    const ack = await sendPhotos(tanner, 1, "look", [photo("c")]);
    const messageId = ack.ok ? ack.data._id! : "";
    await new Promise((resolve) => tanner.emit("delete_message", { room: 1, messageId }, resolve));
    expect(removedPhotos).toEqual(["chat_images/c"]);
  });
});

describe("GIF messages", () => {
  const gif = {
    id: "abc",
    url: "https://media2.giphy.com/media/abc/200.webp",
    width: 356,
    height: 200,
    title: "Dancing cat",
  };
  const sendGif = (socket: Client, room: number, payload: unknown) =>
    new Promise<AckResponse<ChatMessage>>((resolve) =>
      socket.emit("send_message", { room, message: "", gif: payload } as never, resolve),
    );

  it("sends a GIF on its own, and refuses ones not from GIPHY", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);

    const received = new Promise<{ message: ChatMessage }>((resolve) =>
      ben.once("receive_message", resolve),
    );
    const ack = await sendGif(tanner, 1, gif);
    expect(ack.ok && ack.data.gif).toEqual(gif);
    expect((await received).message.gif).toEqual(gif);

    expect((await sendGif(tanner, 1, { ...gif, url: "https://evil.example/pixel.webp" })).ok).toBe(
      false,
    );

    const history = (await (await loginAs("ben")).get("/api/rooms/1")).body.messageHistory;
    expect(history.at(-1).gif).toEqual(gif);
    const discover = (await (await loginAs("ben")).get("/api/rooms/discover")).body;
    expect(discover[0].lastMessage).toEqual({ message: "🎞️ GIF", sentBy: "tanner" });
  });
});

describe("hub activity on the dashboard", () => {
  const mine = async (agent: Awaited<ReturnType<typeof loginAs>>, room: number) => {
    const { body } = await agent.get("/api/rooms/mine").expect(200);
    return [...body.created, ...body.joined].find(
      (r: { room_number: number }) => r.room_number === room,
    );
  };
  const leave = (socket: Client, room: number) =>
    new Promise<void>((resolve) => {
      socket.emit("leave_room", { room });
      setTimeout(resolve, 50);
    });

  it("counts messages from others since you last had the hub open, plus unread mentions", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tannerHttp = await loginAs("tanner");
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await join(ben, 1);
    await send(ben, 1, "before tanner ever looked");
    // Never opened since tracking started: nothing counts as new.
    expect(await mine(tannerHttp, 1)).toMatchObject({ unreadCount: 0, unreadMentions: 0 });

    await join(tanner, 1);
    await leave(tanner, 1);
    await send(ben, 1, "one");
    await send(ben, 1, "two for @tanner");
    await send(ben, 1, "three");
    const room = await mine(tannerHttp, 1);
    expect(room).toMatchObject({
      unreadCount: 3,
      unreadMentions: 1,
      lastMessage: { message: "three", sentBy: "ben" },
    });
    expect(Date.now() - new Date(room.lastActiveAt).getTime()).toBeLessThan(5000);

    // Your own messages never count, and opening the hub clears the count.
    await join(tanner, 1);
    await send(tanner, 1, "mine");
    expect((await mine(tannerHttp, 1)).unreadCount).toBe(0);
  });

  it("closing the tab counts as having seen the hub", async () => {
    await seedRoom({ room_number: 1, created_by: "tanner" });
    const tannerHttp = await loginAs("tanner");
    const [tanner, ben] = await Promise.all([connected("tanner"), connected("ben")]);
    await Promise.all([join(tanner, 1), join(ben, 1)]);
    await send(ben, 1, "hello");
    tanner.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    expect((await mine(tannerHttp, 1)).unreadCount).toBe(0);
    await send(ben, 1, "after you left");
    expect((await mine(tannerHttp, 1)).unreadCount).toBe(1);
  });
});
