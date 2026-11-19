import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { RoomModel } from "../src/models/room.model";
import { env, seedRoom, seedUser, uploadedPic } from "./helpers";

let uploads = 0;
let removed: string[] = [];

const coverApp = createApp({
  env,
  uploadImage: async () => uploadedPic,
  hubCovers: {
    upload: async () => {
      uploads += 1;
      return {
        url: `https://res.cloudinary.com/x/image/upload/v1/hub_covers/c${uploads}.jpg`,
        cloudinary_id: `hub_covers/c${uploads}`,
      };
    },
    remove: async (ids) => {
      removed.push(...ids);
    },
  },
});

async function loginAs(username: string) {
  const agent = request.agent(coverApp);
  await agent.post("/api/auth/login").send({ username, password: "password123" }).expect(200);
  return agent;
}

const attachCover = (agent: Awaited<ReturnType<typeof loginAs>>, room: number) =>
  agent
    .put(`/api/rooms/${room}/cover`)
    .attach("image", Buffer.from("x"), { filename: "a.jpg", contentType: "image/jpeg" });

let tanner: Awaited<ReturnType<typeof loginAs>>;
let ben: Awaited<ReturnType<typeof loginAs>>;

beforeEach(async () => {
  uploads = 0;
  removed = [];
  await Promise.all([seedUser("tanner"), seedUser("ben")]);
  await seedRoom({ room_number: 42, created_by: "tanner" });
  [tanner, ben] = await Promise.all([loginAs("tanner"), loginAs("ben")]);
});

describe("hub covers", () => {
  it("lets the owner set a cover, which shows on explore and in the hub", async () => {
    const res = await attachCover(tanner, 42).expect(200);
    expect(res.body.cover_image).toEqual({
      url: "https://res.cloudinary.com/x/image/upload/v1/hub_covers/c1.jpg",
      cloudinary_id: "hub_covers/c1",
      focus: 50,
    });

    const { body: discover } = await ben.get("/api/rooms/discover").expect(200);
    expect(discover.rooms ?? discover).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ room_number: 42, cover_image: res.body.cover_image }),
      ]),
    );
    const { body: summary } = await ben.get("/api/rooms/42/summary").expect(200);
    expect(summary.cover_image.cloudinary_id).toBe("hub_covers/c1");
  });

  it("removes the old file when a cover is replaced", async () => {
    await attachCover(tanner, 42).expect(200);
    await attachCover(tanner, 42).expect(200);
    expect(removed).toEqual(["hub_covers/c1"]);
  });

  it("only lets the owner change the cover, without uploading anything", async () => {
    await attachCover(ben, 42).expect(403);
    expect(uploads).toBe(0);
    await ben.patch("/api/rooms/42/cover").send({ focus: 10 }).expect(403);
    await ben.delete("/api/rooms/42/cover").expect(403);
  });

  it("rejects non-images and missing files", async () => {
    await tanner
      .put("/api/rooms/42/cover")
      .attach("image", Buffer.from("x"), { filename: "x.svg", contentType: "image/svg+xml" })
      .expect(400);
    await tanner.put("/api/rooms/42/cover").expect(400);
  });

  it("repositions the cover within 0–100", async () => {
    await tanner.patch("/api/rooms/42/cover").send({ focus: 20 }).expect(404);
    await attachCover(tanner, 42).expect(200);
    const res = await tanner.patch("/api/rooms/42/cover").send({ focus: 20.4 }).expect(200);
    expect(res.body.cover_image.focus).toBe(20);
    await tanner.patch("/api/rooms/42/cover").send({ focus: 140 }).expect(400);
  });

  it("removes the cover, and deleting the hub removes its file", async () => {
    await attachCover(tanner, 42).expect(200);
    const res = await tanner.delete("/api/rooms/42/cover").expect(200);
    expect(res.body).not.toHaveProperty("cover_image");
    expect(removed).toEqual(["hub_covers/c1"]);
    expect((await RoomModel.findOne({ room_number: 42 }).lean())?.cover_image).toBeUndefined();

    await attachCover(tanner, 42).expect(200);
    await tanner.delete("/api/rooms/42").expect(204);
    expect(removed).toEqual(["hub_covers/c1", "hub_covers/c2"]);
  });
});
