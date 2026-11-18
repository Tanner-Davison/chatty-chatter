import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import {
  createLinkPreviewer,
  isFetchableUrl,
  isPublicAddress,
  parsePreview,
} from "../src/lib/link-preview";
import { env, loginAs, seedUser, uploadedPic } from "./helpers";

describe("link preview safety", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.5",
    "172.16.3.4",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("treats %s as non-public", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it("allows ordinary public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it.each([
    "http://localhost/",
    "http://app.localhost/",
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://example.com:8080/",
    "http://user:pass@example.com/",
    "ftp://example.com/",
    "javascript:alert(1)",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isFetchableUrl(url)).toBeNull();
  });

  it("accepts normal web URLs", () => {
    expect(isFetchableUrl("https://www.youtube.com/watch?v=abc")?.hostname).toBe("www.youtube.com");
  });
});

describe("parsePreview", () => {
  it("reads Open Graph tags, decoding entities and resolving relative URLs", () => {
    const html = `<html><head>
      <title>Fallback</title>
      <meta property="og:title" content="Tom &amp; Jerry&#39;s &quot;Show&quot;">
      <meta property="og:description" content="A   classic.">
      <meta property="og:image" content="/img/cover.png">
      <meta property="og:site_name" content="Toons">
      <link rel="shortcut icon" href="/fav.png">
    </head><body><meta property="og:title" content="ignored"></body></html>`;
    expect(parsePreview("https://toons.example/show", html)).toEqual({
      url: "https://toons.example/show",
      title: `Tom & Jerry's "Show"`,
      description: "A classic.",
      image: "https://toons.example/img/cover.png",
      siteName: "Toons",
      favicon: "https://toons.example/fav.png",
    });
  });

  it("falls back to <title> and the hostname, and drops non-https images", () => {
    const html = `<head><title>Plain page</title><meta name="description" content="Hi"><meta property="og:image" content="http://insecure.example/a.png"></head>`;
    expect(parsePreview("https://www.plain.example/", html)).toMatchObject({
      title: "Plain page",
      description: "Hi",
      image: undefined,
      siteName: "plain.example",
    });
  });
});

describe("createLinkPreviewer", () => {
  it("caches results and treats images as image previews", async () => {
    const fetcher = vi.fn(async (url: string) => ({ url, contentType: "image/png", body: "" }));
    const preview = createLinkPreviewer(fetcher);
    const first = await preview("https://cdn.example/cat.png");
    await preview("https://cdn.example/cat.png");
    expect(first).toMatchObject({ image: "https://cdn.example/cat.png" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null for pages with nothing to show or that fail", async () => {
    const empty = createLinkPreviewer(async (url) => ({
      url,
      contentType: "text/html",
      body: "<p>hi</p>",
    }));
    expect(await empty("https://empty.example/")).toBeNull();
    const failing = createLinkPreviewer(async () => {
      throw new Error("boom");
    });
    expect(await failing("https://down.example/")).toBeNull();
  });
});

describe("GET /api/link-preview", () => {
  const previewApp = createApp({
    env,
    uploadImage: async () => uploadedPic,
    linkPreviewer: async (url) => (url.includes("good") ? { url, title: "Good page" } : null),
  });

  it("returns a preview, 204 when there's nothing, and 400 for bad URLs", async () => {
    await seedUser("tanner");
    const agent = request.agent(previewApp);
    await agent
      .post("/api/auth/login")
      .send({ username: "tanner", password: "password123" })
      .expect(200);

    const ok = await agent
      .get("/api/link-preview")
      .query({ url: "https://good.example/" })
      .expect(200);
    expect(ok.body).toEqual({ url: "https://good.example/", title: "Good page" });
    await agent.get("/api/link-preview").query({ url: "https://bad.example/" }).expect(204);
    await agent.get("/api/link-preview").query({ url: "javascript:alert(1)" }).expect(400);
  });

  it("needs a session", async () => {
    await request(previewApp)
      .get("/api/link-preview")
      .query({ url: "https://good.example/" })
      .expect(401);
  });
});

describe("GET /api/rooms/discover/surprise", () => {
  it("picks a public hub the user isn't in, or 404s when there are none", async () => {
    await Promise.all([seedUser("tanner"), seedUser("ben")]);
    const tanner = await loginAs("tanner");
    await tanner.get("/api/rooms/discover/surprise").expect(404);

    await tanner
      .post("/api/rooms")
      .send({ roomNumber: 1, name: "Mine", isPrivate: false })
      .expect(201);
    const ben = await loginAs("ben");
    await ben
      .post("/api/rooms")
      .send({ roomNumber: 2, name: "Ben's", isPrivate: false })
      .expect(201);
    await ben
      .post("/api/rooms")
      .send({ roomNumber: 3, name: "Secret", isPrivate: true, password: "hunter22" })
      .expect(201);

    for (let i = 0; i < 5; i++) {
      const { body } = await tanner.get("/api/rooms/discover/surprise").expect(200);
      expect(body).toEqual({ room_number: 2 });
    }
  });
});

describe("oEmbed providers", () => {
  it("reads YouTube links through the oEmbed API", async () => {
    const fetcher = vi.fn(async (url: string) => ({
      url,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Never Gonna Give You Up",
        author_name: "Rick Astley",
        thumbnail_url: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      }),
    }));
    const preview = createLinkPreviewer(fetcher);
    const link = "https://youtu.be/dQw4w9WgXcQ";
    expect(await preview(link)).toEqual({
      url: link,
      title: "Never Gonna Give You Up",
      description: "Rick Astley",
      image: "https://i.ytimg.com/vi/x/hqdefault.jpg",
      siteName: "YouTube",
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`,
    );
  });
});
