import request from "supertest";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../src/middleware/auth";
import { verifySocketToken } from "../src/lib/tokens";
import { UserModel } from "../src/models/user.model";
import { app, env, loginAs, seedUser, uploadedPic } from "./helpers";

describe("POST /api/auth/login", () => {
  it("logs in an existing account and sets an httpOnly session cookie", async () => {
    await seedUser("tanner");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner", password: "password123" })
      .expect(200);

    expect(res.body.username).toBe("tanner");
    expect(res.body).not.toHaveProperty("password");
    expect(res.body).not.toHaveProperty("sentMessages");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("accepts a username typed with different capitals", async () => {
    await seedUser("tanner");
    await request(app)
      .post("/api/auth/login")
      .send({ username: "Tanner", password: "password123" })
      .expect(200);
  });

  it("gives the same 401 for a wrong password and an unknown user", async () => {
    await seedUser("tanner");
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner", password: "nope" })
      .expect(401);
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ username: "ghost", password: "nope" })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("rejects a missing password with field errors", async () => {
    const res = await request(app).post("/api/auth/login").send({ username: "tanner" }).expect(400);
    expect(res.body.issues).toHaveProperty("password");
  });

  it("rejects malformed JSON with 400", async () => {
    await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
  });
});

describe("POST /api/auth/signup", () => {
  it("creates a lowercase user with a hashed password and logs them in", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/signup")
      .field("username", "NewPerson")
      .field("email", "New.Person@Example.com")
      .field("password", "longenough")
      .attach("image", Buffer.from("fake-png"), { filename: "me.png", contentType: "image/png" })
      .expect(201);

    expect(res.body.username).toBe("newperson");
    expect(res.body).toMatchObject({ email: "new.person@example.com", emailVerified: false });
    expect(res.body.profilePic).toEqual(uploadedPic);
    const stored = await UserModel.findOne({ username: "newperson" }).select("+password");
    expect(stored?.password).toMatch(/^\$2[ab]\$12\$/);
    await agent.get("/api/auth/me").expect(200);
  });

  it("works without a photo", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ username: "nophoto", email: "nophoto@example.com", password: "longenough" })
      .expect(201);
  });

  it("rejects a taken username with 409", async () => {
    await seedUser("tanner");
    await request(app)
      .post("/api/auth/signup")
      .send({ username: "tanner", email: "fresh@example.com", password: "longenough" })
      .expect(409);
  });

  it("rejects short passwords and odd usernames", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "a b", email: "not-an-email", password: "short" })
      .expect(400);
    expect(Object.keys(res.body.issues)).toEqual(
      expect.arrayContaining(["username", "email", "password"]),
    );
  });

  it("rejects non-image uploads", async () => {
    await request(app)
      .post("/api/auth/signup")
      .field("username", "person")
      .field("email", "person@example.com")
      .field("password", "longenough")
      .attach("image", Buffer.from("x"), { filename: "x.txt", contentType: "text/plain" })
      .expect(400);
  });
});

describe("session endpoints", () => {
  it("GET /api/auth/me needs a session", async () => {
    await request(app).get("/api/auth/me").expect(401);
  });

  it("rejects a forged cookie", async () => {
    await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=not-a-real-token`)
      .expect(401);
  });

  it("GET /api/auth/me returns the logged-in user", async () => {
    await seedUser("tanner");
    const agent = await loginAs("tanner");
    const res = await agent.get("/api/auth/me").expect(200);
    expect(res.body.username).toBe("tanner");
  });

  it("logout clears the cookie", async () => {
    await seedUser("tanner");
    const agent = await loginAs("tanner");
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("issues a socket token that only works as a socket token", async () => {
    await seedUser("tanner");
    const agent = await loginAs("tanner");
    const { body } = await agent.get("/api/auth/socket-token").expect(200);
    expect(verifySocketToken(env.JWT_SECRET, body.token)?.username).toBe("tanner");
    await request(app)
      .get("/api/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${body.token}`)
      .expect(401);
  });
});

describe("app", () => {
  it("answers health checks and 404s unknown routes with JSON", async () => {
    await request(app).get("/api/health").expect(200, { ok: true });
    const res = await request(app).get("/api/nope").expect(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("allows the production origin and deploy previews, not others", async () => {
    const allowed = await request(app)
      .get("/api/health")
      .set("Origin", "https://chattychatter.com");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://chattychatter.com");
    const preview = "https://deploy-preview-7--dancing-quokka-6b5001.netlify.app";
    const previewRes = await request(app).get("/api/health").set("Origin", preview);
    expect(previewRes.headers["access-control-allow-origin"]).toBe(preview);
    const evil = await request(app).get("/api/health").set("Origin", "https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
