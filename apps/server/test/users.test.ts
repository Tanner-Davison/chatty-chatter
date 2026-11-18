import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "../src/models/user.model";
import { app, loginAs, seedUser } from "./helpers";

type Agent = Awaited<ReturnType<typeof loginAs>>;
let tanner: Agent;

beforeEach(async () => {
  await Promise.all([seedUser("tanner"), seedUser("ben")]);
  tanner = await loginAs("tanner");
});

describe("profiles", () => {
  it("needs a session", async () => {
    await request(app).get("/api/users/ben").expect(401);
  });

  it("returns another user's profile without secrets", async () => {
    const { body } = await tanner.get("/api/users/ben").expect(200);
    expect(body.username).toBe("ben");
    expect(body).not.toHaveProperty("password");
  });

  it("404s unknown users", async () => {
    await tanner.get("/api/users/ghost").expect(404);
  });

  it("PATCH /api/users/me edits only the caller's profile", async () => {
    const { body } = await tanner
      .patch("/api/users/me")
      .send({ profileBio: "  Hi there ", profession: "dev", username: "ben" })
      .expect(200);
    expect(body).toMatchObject({ username: "tanner", profileBio: "Hi there", profession: "dev" });
    expect((await UserModel.findOne({ username: "ben" }))?.profileBio).toBeUndefined();
  });

  it("rejects an over-long bio", async () => {
    await tanner
      .patch("/api/users/me")
      .send({ profileBio: "x".repeat(501) })
      .expect(400);
  });
});

describe("friends", () => {
  it("adds, checks and removes a friend", async () => {
    await tanner.get("/api/users/me/friends/ben").expect(200, { isFriend: false });
    await tanner.put("/api/users/me/friends/ben").expect(200, { isFriend: true });
    await tanner.put("/api/users/me/friends/ben").expect(200, { isFriend: true });
    await tanner.get("/api/users/me/friends/ben").expect(200, { isFriend: true });
    expect((await UserModel.findOne({ username: "tanner" }))?.friends).toEqual(["ben"]);

    await tanner.delete("/api/users/me/friends/ben").expect(200, { isFriend: false });
    expect((await UserModel.findOne({ username: "tanner" }))?.friends).toEqual([]);
  });

  it("can't befriend yourself or someone who doesn't exist", async () => {
    await tanner.put("/api/users/me/friends/tanner").expect(400);
    await tanner.put("/api/users/me/friends/ghost").expect(404);
  });
});

describe("PATCH /api/users/me/rooms/:roomNumber/preferences", () => {
  it("saves, updates and resets colours per hub", async () => {
    const set = await tanner
      .patch("/api/users/me/rooms/7/preferences")
      .send({ sentColor: "violet", receivedColor: "ocean" })
      .expect(200);
    expect(set.body.roomPreferences).toEqual({
      7: { sentColor: "violet", receivedColor: "ocean" },
    });

    await tanner
      .patch("/api/users/me/rooms/8/preferences")
      .send({ sentColor: "amber" })
      .expect(200);
    const reset = await tanner
      .patch("/api/users/me/rooms/7/preferences")
      .send({ sentColor: null })
      .expect(200);
    expect(reset.body.roomPreferences).toEqual({
      7: { receivedColor: "ocean" },
      8: { sentColor: "amber" },
    });
    const me = await tanner.get("/api/auth/me").expect(200);
    expect(me.body.roomPreferences["8"]).toEqual({ sentColor: "amber" });
  });

  it("rejects colours outside the palette", async () => {
    await tanner
      .patch("/api/users/me/rooms/7/preferences")
      .send({ sentColor: "#ff0000" })
      .expect(400);
    await tanner
      .patch("/api/users/me/rooms/abc/preferences")
      .send({ sentColor: "violet" })
      .expect(400);
  });

  it("keeps colour choices private", async () => {
    await tanner
      .patch("/api/users/me/rooms/7/preferences")
      .send({ sentColor: "violet" })
      .expect(200);
    const ben = await loginAs("ben");
    const { body } = await ben.get("/api/users/tanner").expect(200);
    expect(body).not.toHaveProperty("roomPreferences");
  });
});
