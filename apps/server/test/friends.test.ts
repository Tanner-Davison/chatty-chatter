import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { Notification } from "@chatty/shared";
import { createApp } from "../src/app";
import { UserModel } from "../src/models/user.model";
import { env, seedUser, uploadedPic } from "./helpers";

// Records live pushes so tests can check who was told what.
const sent: { to: string; type: string }[] = [];
const changed: string[] = [];
const app = createApp({
  env,
  uploadImage: async () => uploadedPic,
  notifier: {
    send: (to, n: Notification) => sent.push({ to, type: n.type }),
    changed: (to) => changed.push(to),
  },
});

async function login(username: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ username, password: "password123" }).expect(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof login>>;
let tanner: Agent;
let ben: Agent;

const friendsOf = async (u: string) => (await UserModel.findOne({ username: u }))?.friends ?? [];

beforeEach(async () => {
  sent.length = 0;
  changed.length = 0;
  await Promise.all([seedUser("tanner"), seedUser("ben"), seedUser("cara")]);
  [tanner, ben] = await Promise.all([login("tanner"), login("ben")]);
});

describe("friend requests", () => {
  it("request → notify → accept makes a two-way friendship", async () => {
    await tanner.get("/api/users/me/friends/ben").expect(200, { status: "none" });
    const sentReq = await tanner.post("/api/users/me/friends/ben").expect(200);
    expect(sentReq.body.status).toBe("request_sent");
    expect(sent).toEqual([{ to: "ben", type: "friend_request" }]);
    // Sending again is harmless.
    expect((await tanner.post("/api/users/me/friends/ben").expect(200)).body).toEqual(sentReq.body);

    const benView = await ben.get("/api/users/me/friends/tanner").expect(200);
    expect(benView.body).toEqual({ status: "request_received", requestId: sentReq.body.requestId });
    const note = (await ben.get("/api/notifications").expect(200)).body.notifications[0];
    expect(note).toMatchObject({
      type: "friend_request",
      sentBy: "tanner",
      requestStatus: "pending",
    });

    await tanner.post(`/api/friend-requests/${note.requestId}/accept`).expect(403);
    await ben
      .post(`/api/friend-requests/${note.requestId}/accept`)
      .expect(200, { status: "friends" });
    await ben.post(`/api/friend-requests/${note.requestId}/accept`).expect(409);

    expect(await friendsOf("tanner")).toEqual(["ben"]);
    expect(await friendsOf("ben")).toEqual(["tanner"]);
    expect(sent.at(-1)).toEqual({ to: "tanner", type: "friend_accepted" });
    expect(changed).toContain("ben");
    const settled = (await ben.get("/api/notifications")).body.notifications[0];
    expect(settled).toMatchObject({ requestStatus: "accepted", read: true });
    await tanner.post("/api/users/me/friends/ben").expect(409);
  });

  it("a mutual request accepts straight away", async () => {
    await tanner.post("/api/users/me/friends/ben").expect(200);
    await ben.post("/api/users/me/friends/tanner").expect(200, { status: "friends" });
    expect(await friendsOf("tanner")).toEqual(["ben"]);
  });

  it("decline: only the recipient can, and it leaves no friendship", async () => {
    const { requestId } = (await tanner.post("/api/users/me/friends/ben")).body;
    await tanner.post(`/api/friend-requests/${requestId}/decline`).expect(403);
    await ben.post(`/api/friend-requests/${requestId}/decline`).expect(200, { status: "none" });
    expect(await friendsOf("ben")).toEqual([]);
    await tanner.get("/api/users/me/friends/ben").expect(200, { status: "none" });
  });

  it("cancel: only the sender can, and the notification disappears", async () => {
    const { requestId } = (await tanner.post("/api/users/me/friends/ben")).body;
    await ben.delete(`/api/friend-requests/${requestId}`).expect(403);
    await tanner.delete(`/api/friend-requests/${requestId}`).expect(200, { status: "none" });
    expect((await ben.get("/api/notifications")).body.notifications).toEqual([]);
    expect(changed).toContain("ben");
  });

  it("refuses yourself, unknown users and bad ids", async () => {
    await tanner.post("/api/users/me/friends/tanner").expect(400);
    await tanner.post("/api/users/me/friends/ghost").expect(404);
    await tanner.post("/api/friend-requests/nope/accept").expect(400);
    await tanner.post(`/api/friend-requests/${"0".repeat(24)}/accept`).expect(404);
  });

  it("removing a friend ends it on both sides", async () => {
    await tanner.post("/api/users/me/friends/ben");
    await ben.post("/api/users/me/friends/tanner");
    await ben.delete("/api/users/me/friends/tanner").expect(200, { status: "none" });
    expect(await friendsOf("tanner")).toEqual([]);
    expect(await friendsOf("ben")).toEqual([]);
  });
});

describe("deleting notifications", () => {
  it("deletes one, then all, and only your own", async () => {
    await tanner.post("/api/users/me/friends/ben");
    await (await login("cara")).post("/api/users/me/friends/ben");
    const list = (await ben.get("/api/notifications")).body;
    expect(list).toMatchObject({ total: 2, unreadCount: 2 });

    await tanner.delete(`/api/notifications/${list.notifications[0]._id}`).expect(204);
    expect((await ben.get("/api/notifications")).body.total).toBe(2);

    await ben.delete(`/api/notifications/${list.notifications[0]._id}`).expect(204);
    expect((await ben.get("/api/notifications")).body.total).toBe(1);
    await ben.delete("/api/notifications").expect(204);
    expect((await ben.get("/api/notifications")).body).toMatchObject({ total: 0, unreadCount: 0 });
  });

  it("supports a page size for the full list", async () => {
    await tanner.post("/api/users/me/friends/ben");
    await (await login("cara")).post("/api/users/me/friends/ben");
    const one = (await ben.get("/api/notifications?limit=1")).body;
    expect(one.notifications).toHaveLength(1);
    expect(one.total).toBe(2);
    await ben.get("/api/notifications?limit=0").expect(400);
  });
});
