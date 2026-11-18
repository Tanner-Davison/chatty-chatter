import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { RoomModel } from "../src/models/room.model";
import { UserModel } from "../src/models/user.model";
import { app, loginAs, seedRoom, seedUser } from "./helpers";

type Agent = Awaited<ReturnType<typeof loginAs>>;

let tanner: Agent;
let ben: Agent;

beforeEach(async () => {
  await Promise.all([seedUser("tanner"), seedUser("ben")]);
  [tanner, ben] = await Promise.all([loginAs("tanner"), loginAs("ben")]);
});

describe("room endpoints require a session", () => {
  it.each([
    ["get", "/api/rooms/mine"],
    ["get", "/api/rooms/explore"],
    ["get", "/api/rooms/1"],
    ["post", "/api/rooms"],
    ["delete", "/api/rooms/1"],
    ["put", "/api/rooms/1/membership"],
  ] as const)("%s %s → 401", async (method, path) => {
    await request(app)[method](path).expect(401);
  });
});

describe("POST /api/rooms", () => {
  it("creates a public room owned by the caller, whatever the body says", async () => {
    const res = await tanner
      .post("/api/rooms")
      .send({ roomNumber: 42, name: "Pub", category: "chat", isPrivate: false, createdBy: "ben" })
      .expect(201);
    expect(res.body).toMatchObject({
      room_number: 42,
      room_name: "Pub",
      created_by: "tanner",
      private_room: false,
    });

    const user = await UserModel.findOne({ username: "tanner" });
    expect(user?.roomsCreated.map((r) => r.room)).toEqual([42]);
  });

  it("creates a private room with a hashed password that is never returned", async () => {
    const res = await tanner
      .post("/api/rooms")
      .send({ roomNumber: 7, name: "Secret", isPrivate: true, password: "hunter22" })
      .expect(201);
    expect(res.body).not.toHaveProperty("private_room_password");

    const stored = await RoomModel.findOne({ room_number: 7 }).select("+private_room_password");
    expect(stored?.private_room_password).toMatch(/^\$2[ab]\$/);
  });

  it("requires a password for private rooms", async () => {
    await tanner
      .post("/api/rooms")
      .send({ roomNumber: 7, name: "Secret", isPrivate: true })
      .expect(400);
  });

  it("rejects a taken room number with 409", async () => {
    await seedRoom({ room_number: 42, created_by: "ben" });
    await tanner
      .post("/api/rooms")
      .send({ roomNumber: 42, name: "Dup", isPrivate: false })
      .expect(409);
  });

  it("reports availability", async () => {
    await seedRoom({ room_number: 42, created_by: "ben" });
    await tanner.get("/api/rooms/42/availability").expect(200, { available: false });
    await tanner.get("/api/rooms/43/availability").expect(200, { available: true });
    await tanner.get("/api/rooms/abc/availability").expect(400);
  });
});

describe("reading rooms", () => {
  it("returns a public room with its history, timestamps as stored", async () => {
    await seedRoom({ room_number: 1, created_by: "ben" });
    const res = await tanner.get("/api/rooms/1").expect(200);
    expect(res.body.messageHistory).toEqual([
      expect.objectContaining({ message: "hello", sentBy: "ben", timestamp: "11/26 12:44 am" }),
    ]);
  });

  it("hides a private room's messages until the user joins with the password", async () => {
    await seedRoom({ room_number: 9, created_by: "ben", private_room: true, password: "hunter22" });

    await tanner.get("/api/rooms/9").expect(403);
    const summary = await tanner.get("/api/rooms/9/summary").expect(200);
    expect(summary.body).toMatchObject({ private_room: true, created_by: "ben" });
    expect(summary.body).not.toHaveProperty("messageHistory");
    expect(summary.body).not.toHaveProperty("private_room_password");

    await tanner.put("/api/rooms/9/membership").send({}).expect(400);
    await tanner.put("/api/rooms/9/membership").send({ password: "wrong" }).expect(403);
    await tanner.put("/api/rooms/9/membership").send({ password: "hunter22" }).expect(200);
    await tanner.get("/api/rooms/9").expect(200);
  });

  it("lets the creator read their private room", async () => {
    await seedRoom({ room_number: 9, created_by: "ben", private_room: true, password: "hunter22" });
    await ben.get("/api/rooms/9").expect(200);
  });

  it("404s unknown rooms", async () => {
    await tanner.get("/api/rooms/12345").expect(404);
  });
});

describe("room lists", () => {
  beforeEach(async () => {
    await Promise.all([
      seedRoom({ room_number: 1, created_by: "tanner", room_name: "Mine" }),
      seedRoom({ room_number: 2, created_by: "ben", room_name: "Joined" }),
      seedRoom({ room_number: 3, created_by: "ben", room_name: "Other" }),
    ]);
    await tanner.put("/api/rooms/2/membership").send({}).expect(200);
  });

  it("GET /api/rooms/mine splits created and joined rooms, without messages", async () => {
    const { body } = await tanner.get("/api/rooms/mine").expect(200);
    expect(body.created.map((r: { room_number: number }) => r.room_number)).toEqual([1]);
    expect(body.joined.map((r: { room_number: number }) => r.room_number)).toEqual([2]);
    expect(body.created[0]).not.toHaveProperty("messageHistory");
  });

  it("GET /api/rooms/explore lists only rooms the user hasn't created or joined", async () => {
    const { body } = await tanner.get("/api/rooms/explore").expect(200);
    expect(body.map((r: { room_number: number }) => r.room_number)).toEqual([3]);
  });

  it("joining twice doesn't duplicate the room", async () => {
    await tanner.put("/api/rooms/2/membership").send({}).expect(200);
    const user = await UserModel.findOne({ username: "tanner" });
    expect(user?.roomsJoined.filter((r) => r.room === 2)).toHaveLength(1);
  });

  it("leaving removes only the caller's membership", async () => {
    await seedUser("cara");
    const cara = await loginAs("cara");
    await cara.put("/api/rooms/3/membership").send({}).expect(200);
    await tanner.put("/api/rooms/3/membership").send({}).expect(200);
    await tanner.delete("/api/rooms/3/membership").expect(204);

    const [t, c] = await Promise.all([
      UserModel.findOne({ username: "tanner" }),
      UserModel.findOne({ username: "cara" }),
    ]);
    expect(t?.roomsJoined.map((r) => r.room)).toEqual([2]);
    expect(c?.roomsJoined.map((r) => r.room)).toEqual([3]);
  });

  it("searches by name prefix, case-insensitively, treating input literally", async () => {
    const { body } = await tanner.get("/api/rooms/search").query({ name: "oth" }).expect(200);
    expect(body.map((r: { room_name: string }) => r.room_name)).toEqual(["Other"]);
    await tanner.get("/api/rooms/search").query({ name: ".*" }).expect(200, []);
  });
});

describe("DELETE /api/rooms/:roomNumber", () => {
  it("only the creator can delete a room", async () => {
    await seedRoom({ room_number: 5, created_by: "ben" });
    await tanner.delete("/api/rooms/5").expect(403);
    expect(await RoomModel.exists({ room_number: 5 })).toBeTruthy();
  });

  it("deletes the room and removes it from every user's lists", async () => {
    await ben
      .post("/api/rooms")
      .send({ roomNumber: 5, name: "Gone", isPrivate: false })
      .expect(201);
    await tanner.put("/api/rooms/5/membership").send({}).expect(200);

    await ben.delete("/api/rooms/5").expect(204);

    expect(await RoomModel.exists({ room_number: 5 })).toBeNull();
    const [t, b] = await Promise.all([
      UserModel.findOne({ username: "tanner" }),
      UserModel.findOne({ username: "ben" }),
    ]);
    expect(t?.roomsJoined).toHaveLength(0);
    expect(b?.roomsCreated).toHaveLength(0);
  });
});
