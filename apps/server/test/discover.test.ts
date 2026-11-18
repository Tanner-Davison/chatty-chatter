import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { DiscoverRoom, RoomPeek } from "@chatty/shared";
import { createApp } from "../src/app";
import { RoomModel } from "../src/models/room.model";
import { UserModel } from "../src/models/user.model";
import { env, loginAs, seedUser, uploadedPic } from "./helpers";

const HOUR = 60 * 60 * 1000;

/** A message whose id says it was sent `hoursAgo` hours ago, like real ones do. */
const messageAt = (hoursAgo: number, sentBy = "ben", message = "hi") => ({
  _id: Types.ObjectId.createFromTime(Math.floor((Date.now() - hoursAgo * HOUR) / 1000)),
  message,
  sentBy,
  timestamp: "11/26 12:44 am",
});

async function seedActiveRoom(fields: {
  room_number: number;
  room_name: string;
  created_by?: string;
  room_category?: string;
  private_room?: boolean;
  users_in_room?: string[];
  messages?: ReturnType<typeof messageAt>[];
}) {
  const { messages = [], created_by = "ben", ...rest } = fields;
  return RoomModel.create({
    created_by,
    users_in_room: [created_by],
    ...rest,
    messageHistory: messages,
  });
}

type Agent = Awaited<ReturnType<typeof loginAs>>;
let tanner: Agent;

const numbers = (rooms: DiscoverRoom[]) => rooms.map((r) => r.room_number);

beforeEach(async () => {
  await Promise.all([seedUser("tanner"), seedUser("ben"), seedUser("cara")]);
  tanner = await loginAs("tanner");
});

describe("GET /api/rooms/discover", () => {
  beforeEach(async () => {
    await seedActiveRoom({
      room_number: 1,
      room_name: "Quiet Books",
      room_category: "Books and Literature",
      users_in_room: ["ben", "cara", "dan"],
      messages: [messageAt(72), messageAt(48)],
    });
    await seedActiveRoom({
      room_number: 2,
      room_name: "Busy Gaming",
      room_category: "Gaming",
      messages: [messageAt(5), messageAt(3), messageAt(1, "cara", "gg")],
    });
    await seedActiveRoom({
      room_number: 3,
      room_name: "Secret Gaming",
      room_category: "Gaming",
      private_room: true,
      messages: [messageAt(2, "ben", "the secret plan")],
    });
  });

  it("works out activity from message ids, even with unparseable timestamps", async () => {
    const { body } = await tanner.get("/api/rooms/discover").expect(200);
    const busy = (body as DiscoverRoom[]).find((r) => r.room_number === 2)!;
    expect(busy).toMatchObject({
      messageCount: 3,
      recentMessageCount: 3,
      onlineCount: 0,
      membership: "none",
    });
    expect(Date.now() - new Date(busy.lastActiveAt).getTime()).toBeLessThan(1.1 * HOUR);
    expect(busy.lastMessage).toEqual({ message: "gg", sentBy: "cara" });

    const quiet = (body as DiscoverRoom[]).find((r) => r.room_number === 1)!;
    expect(quiet.recentMessageCount).toBe(0);
    expect(quiet.memberPreview).toEqual(["dan", "cara", "ben"]);
  });

  it("never reveals a private room's last message", async () => {
    const { body } = await tanner.get("/api/rooms/discover").expect(200);
    const secret = (body as DiscoverRoom[]).find((r) => r.room_number === 3)!;
    expect(secret.private_room).toBe(true);
    expect(secret).not.toHaveProperty("lastMessage");
    expect(JSON.stringify(body)).not.toContain("secret plan");
  });

  it("sorts by trending, activity, members and newest", async () => {
    const get = async (sort: string) =>
      numbers((await tanner.get(`/api/rooms/discover?sort=${sort}`).expect(200)).body);
    expect(await get("trending")).toEqual([2, 3, 1]);
    expect(await get("active")).toEqual([2, 3, 1]);
    expect((await get("members"))[0]).toBe(1);
    expect(await get("newest")).toEqual([3, 2, 1]);
  });

  it("filters by category and by name", async () => {
    const byCategory = await tanner.get("/api/rooms/discover?category=Gaming").expect(200);
    expect(numbers(byCategory.body).sort()).toEqual([2, 3]);
    const byName = await tanner.get("/api/rooms/discover?q=busy").expect(200);
    expect(numbers(byName.body)).toEqual([2]);
    await tanner.get("/api/rooms/discover?q=.*").expect(200, []);
  });

  it("rejects unknown sorts and categories", async () => {
    await tanner.get("/api/rooms/discover?sort=random").expect(400);
    await tanner.get("/api/rooms/discover?category=Nope").expect(400);
  });

  it("marks the viewer's own and joined rooms", async () => {
    await seedActiveRoom({ room_number: 9, room_name: "Mine", created_by: "tanner" });
    await tanner.put("/api/rooms/1/membership").send({}).expect(200);
    const { body } = await tanner.get("/api/rooms/discover").expect(200);
    const membership = Object.fromEntries(
      (body as DiscoverRoom[]).map((r) => [r.room_number, r.membership]),
    );
    expect(membership).toMatchObject({ 1: "joined", 2: "none", 9: "owner" });
  });

  it("ranks rooms with people online first when trending", async () => {
    const app = createApp({
      env,
      uploadImage: async () => uploadedPic,
      presence: {
        onlineCounts: (rooms) => new Map(rooms.filter((r) => r === 1).map((r) => [r, 2])),
      },
    });
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "tanner", password: "password123" })
      .expect(200);
    const { body } = await agent.get("/api/rooms/discover").expect(200);
    expect(body[0]).toMatchObject({ room_number: 1, onlineCount: 2 });
  });
});

describe("GET /api/rooms/discover/friends", () => {
  it("is empty without friends", async () => {
    await tanner.get("/api/rooms/discover/friends").expect(200, []);
  });

  it("lists rooms friends created or joined, naming them, but not the viewer's own", async () => {
    await seedActiveRoom({ room_number: 1, room_name: "Ben's", created_by: "ben" });
    await seedActiveRoom({ room_number: 2, room_name: "Dan's", created_by: "dan" });
    await seedActiveRoom({ room_number: 3, room_name: "Nobody's", created_by: "dan" });
    await seedActiveRoom({ room_number: 4, room_name: "Mine", created_by: "tanner" });
    await UserModel.updateOne(
      { username: "cara" },
      { $push: { roomsJoined: [{ room: 2 }, { room: 4 }] } },
    );
    await UserModel.updateOne({ username: "tanner" }, { $set: { friends: ["ben", "cara"] } });

    const { body } = await tanner.get("/api/rooms/discover/friends").expect(200);
    const here = Object.fromEntries(
      (body as DiscoverRoom[]).map((r) => [r.room_number, r.friendsHere]),
    );
    expect(here).toEqual({ 1: ["ben"], 2: ["cara"] });
  });
});

describe("GET /api/rooms/:roomNumber/peek", () => {
  it("shows the last ten messages of a public room", async () => {
    await seedActiveRoom({
      room_number: 1,
      room_name: "Chatty",
      messages: Array.from({ length: 15 }, (_, i) => messageAt(15 - i, "ben", `m${i}`)),
    });
    const { body } = (await tanner.get("/api/rooms/1/peek").expect(200)) as { body: RoomPeek };
    expect(body.locked).toBe(false);
    expect(body.messages.map((m) => m.message)).toEqual(
      Array.from({ length: 10 }, (_, i) => `m${i + 5}`),
    );
  });

  it("keeps a private room locked unless the viewer is a member", async () => {
    await seedActiveRoom({
      room_number: 3,
      room_name: "Secret",
      private_room: true,
      messages: [messageAt(1, "ben", "shh")],
    });
    const locked = (await tanner.get("/api/rooms/3/peek").expect(200)).body as RoomPeek;
    expect(locked).toMatchObject({ locked: true, messages: [] });
    expect(JSON.stringify(locked)).not.toContain("shh");

    const ben = await loginAs("ben");
    const owner = (await ben.get("/api/rooms/3/peek").expect(200)).body as RoomPeek;
    expect(owner.locked).toBe(false);
    expect(owner.messages[0]?.message).toBe("shh");
  });

  it("404s unknown rooms", async () => {
    await tanner.get("/api/rooms/999/peek").expect(404);
  });
});
