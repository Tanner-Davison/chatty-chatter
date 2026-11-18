import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { MyRooms, Notification, RoomInvite, RoomSummary } from "@chatty/shared";
import { createApp } from "../src/app";
import { RoomModel } from "../src/models/room.model";
import { env, seedRoom, seedUser, TEST_ROOM_PASSWORD, uploadedPic } from "./helpers";

// Records live pushes so tests can check who was told what.
const sent: { to: string; notification: Notification }[] = [];
const app = createApp({
  env,
  uploadImage: async () => uploadedPic,
  notifier: { send: (to, notification) => sent.push({ to, notification }), changed: () => {} },
});

async function login(username: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password: "password123" }).expect(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof login>>;
let tanner: Agent;
let ben: Agent;
let cara: Agent;

const joinedNumbers = async (agent: Agent) =>
  ((await agent.get("/api/rooms/mine").expect(200)).body as MyRooms).joined.map(
    (r) => r.room_number,
  );

const inviteCode = async (agent: Agent, room: number) =>
  ((await agent.get(`/api/rooms/${room}/invite`).expect(200)).body as RoomInvite).code;

beforeEach(async () => {
  sent.length = 0;
  await Promise.all([seedUser("tanner"), seedUser("ben"), seedUser("cara")]);
  [tanner, ben, cara] = await Promise.all([login("tanner"), login("ben"), login("cara")]);
  await tanner
    .post("/api/rooms")
    .send({ roomNumber: 7, name: "Secret", category: "General", isPrivate: true })
    .expect(201);
});

describe("invite-only hubs", () => {
  it("can't be joined without an invite, even with no password", async () => {
    await ben.put("/api/rooms/7/membership").send({}).expect(403);
    await ben.get("/api/rooms/7").expect(403);
  });

  it("are left out of discovery, search and peeks for outsiders", async () => {
    const discover = (await ben.get("/api/rooms/discover").expect(200)).body as RoomSummary[];
    expect(discover.map((r) => r.room_number)).not.toContain(7);
    const search = (await ben.get("/api/rooms/search?name=Sec").expect(200)).body as RoomSummary[];
    expect(search).toEqual([]);
    await ben.get("/api/rooms/7/peek").expect(404);
  });

  it("show outsiders only that the hub is invite-only", async () => {
    const { body } = await ben.get("/api/rooms/7/summary").expect(200);
    expect(body).toMatchObject({ room_number: 7, invite_only: true, users_in_room: [] });
    expect(body).not.toHaveProperty("room_name");
  });
});

describe("invite links", () => {
  it("gives every member the same code and never leaks it in room JSON", async () => {
    const code = await inviteCode(tanner, 7);
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await inviteCode(tanner, 7)).toBe(code);

    const room = await tanner.get("/api/rooms/7").expect(200);
    expect(JSON.stringify(room.body)).not.toContain(code);
  });

  it("joins the hub without a password and lists it among the user's hubs", async () => {
    const code = await inviteCode(tanner, 7);
    const { body } = await ben.post(`/api/invites/${code}`).expect(200);
    expect(body).toMatchObject({ room_number: 7, room_name: "Secret" });

    await ben.get("/api/rooms/7").expect(200);
    expect(await joinedNumbers(ben)).toEqual([7]);
    // Accepting twice is harmless.
    await ben.post(`/api/invites/${code}`).expect(200);
    expect(await joinedNumbers(ben)).toEqual([7]);
  });

  it("works for password-protected private hubs too", async () => {
    await seedRoom({
      room_number: 8,
      created_by: "tanner",
      private_room: true,
      password: TEST_ROOM_PASSWORD,
    });
    await ben.post(`/api/invites/${await inviteCode(tanner, 8)}`).expect(200);
    await ben.get("/api/rooms/8").expect(200);
  });

  it("can be shared by any member, but not by outsiders", async () => {
    await ben.post(`/api/invites/${await inviteCode(tanner, 7)}`).expect(200);
    const fromBen = await inviteCode(ben, 7);
    await cara.get("/api/rooms/7/invite").expect(403);
    await cara.post(`/api/invites/${fromBen}`).expect(200);
    await cara.get("/api/rooms/7").expect(200);
  });

  it("doesn't exist for public hubs", async () => {
    await seedRoom({ room_number: 42, created_by: "tanner" });
    await tanner.get("/api/rooms/42/invite").expect(400);
  });

  it("stop working after the owner resets the link", async () => {
    const old = await inviteCode(tanner, 7);
    await ben.post("/api/rooms/7/invite/reset").expect(403);
    const { body } = await tanner.post("/api/rooms/7/invite/reset").expect(200);
    expect((body as RoomInvite).code).not.toBe(old);

    await ben.post(`/api/invites/${old}`).expect(404);
    await ben.post(`/api/invites/${(body as RoomInvite).code}`).expect(200);
  });

  it("rejects malformed and unknown codes", async () => {
    await ben.post("/api/invites/not!valid").expect(400);
    await ben.post("/api/invites/AAAAAAAAAAAAAAAAAAAAAA").expect(404);
    await request(app).post("/api/invites/AAAAAAAAAAAAAAAAAAAAAA").expect(401);
  });
});

describe("POST /api/rooms/:roomNumber/members", () => {
  it("lets the owner add someone, who is notified and gets access", async () => {
    await tanner.post("/api/rooms/7/members").send({ username: "Ben" }).expect(204);

    await ben.get("/api/rooms/7").expect(200);
    expect(await joinedNumbers(ben)).toEqual([7]);
    expect(sent).toEqual([
      {
        to: "ben",
        notification: expect.objectContaining({
          type: "room_added",
          sentBy: "tanner",
          room: 7,
          roomName: "Secret",
        }) as Notification,
      },
    ]);
    const stored = await RoomModel.findOne({ room_number: 7 });
    expect(stored?.users_in_room).toContain("ben");
  });

  it("lets members add people, but not outsiders", async () => {
    await cara.post("/api/rooms/7/members").send({ username: "cara" }).expect(403);
    await tanner.post("/api/rooms/7/members").send({ username: "ben" }).expect(204);
    await ben.post("/api/rooms/7/members").send({ username: "cara" }).expect(204);
    await cara.get("/api/rooms/7").expect(200);
  });

  it("rejects unknown users and people already inside", async () => {
    await tanner.post("/api/rooms/7/members").send({ username: "nobody" }).expect(404);
    await tanner.post("/api/rooms/7/members").send({ username: "tanner" }).expect(409);
    await tanner.post("/api/rooms/7/members").send({ username: "ben" }).expect(204);
    await tanner.post("/api/rooms/7/members").send({ username: "ben" }).expect(409);
  });
});
