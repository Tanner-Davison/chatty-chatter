import request from "supertest";
import { describe, expect, it } from "vitest";
import { gifSchema, type GifResult } from "@chatty/shared";
import { createApp } from "../src/app";
import { toGifResult, unavailableGifSearch } from "../src/lib/gifs";
import { env, seedUser, uploadedPic } from "./helpers";

const result: GifResult = {
  id: "abc",
  url: "https://media2.giphy.com/media/abc/200.webp",
  preview: "https://media2.giphy.com/media/abc/200w.webp",
  width: 356,
  height: 200,
  title: "Dancing cat",
};

async function agentFor(app: ReturnType<typeof createApp>) {
  await seedUser("tanner");
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .send({ username: "tanner", password: "password123" })
    .expect(200);
  return agent;
}

describe("GET /api/gifs", () => {
  it("searches, or lists trending GIFs without a query", async () => {
    const calls: [string, number][] = [];
    const app = createApp({
      env,
      uploadImage: async () => uploadedPic,
      gifSearch: async (q, offset) => {
        calls.push([q, offset]);
        return [result];
      },
    });
    const agent = await agentFor(app);

    expect((await agent.get("/api/gifs?q=%20cats%20&offset=24").expect(200)).body).toEqual([
      result,
    ]);
    await agent.get("/api/gifs").expect(200);
    expect(calls).toEqual([
      ["cats", 24],
      ["", 0],
    ]);
    await agent.get(`/api/gifs?q=${"x".repeat(101)}`).expect(400);
    await agent.get("/api/gifs?offset=-1").expect(400);
  });

  it("needs a login, and says when GIFs aren't set up", async () => {
    const app = createApp({ env, uploadImage: async () => uploadedPic });
    await request(app).get("/api/gifs").expect(401);
    const agent = await agentFor(
      createApp({ env, uploadImage: async () => uploadedPic, gifSearch: unavailableGifSearch }),
    );
    expect((await agent.get("/api/gifs").expect(503)).body.error).toBe(
      "GIFs aren't available right now",
    );
  });
});

describe("toGifResult", () => {
  const giphy = {
    id: "abc",
    title: " Dancing cat ",
    images: {
      fixed_height: {
        url: "https://media2.giphy.com/media/abc/200.gif",
        webp: "https://media2.giphy.com/media/abc/200.webp",
        width: "356",
        height: "200",
      },
      fixed_width: { webp: "https://media2.giphy.com/media/abc/200w.webp" },
    },
  };

  it("picks the webp renditions and numeric sizes", () => {
    expect(toGifResult(giphy)).toEqual(result);
  });

  it("skips GIFs missing sizes or hosted elsewhere", () => {
    expect(toGifResult({ ...giphy, images: {} })).toBeNull();
    expect(
      toGifResult({
        ...giphy,
        images: {
          ...giphy.images,
          fixed_height: { ...giphy.images.fixed_height, webp: "https://evil.example/x.webp" },
        },
      }),
    ).toBeNull();
  });
});

describe("gifSchema", () => {
  it.each([
    "https://media.giphy.com/media/abc/200.webp",
    "https://media4.giphy.com/media/v1.Y2lk/abc/200.webp?cid=1&rid=200.webp",
    "https://i.giphy.com/abc.webp",
  ])("accepts %s", (url) => {
    expect(gifSchema.safeParse({ ...result, url }).success).toBe(true);
  });

  it.each([
    "http://media.giphy.com/media/abc/200.webp",
    "https://media.giphy.com.evil.example/x.webp",
    "https://media.giphy.com@evil.example/x.webp",
    "https://evil.example/media.giphy.com/x.webp",
  ])("refuses %s", (url) => {
    expect(gifSchema.safeParse({ ...result, url }).success).toBe(false);
  });
});
