import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Email } from "../src/lib/mailer";
import { EmailTokenModel } from "../src/models/email-token.model";
import { UserModel } from "../src/models/user.model";
import { env, seedUser, uploadedPic } from "./helpers";

// Captures sent emails so tests can follow their links like a user would.
const outbox: Email[] = [];
const app = createApp({
  env,
  uploadImage: async () => uploadedPic,
  mailer: { send: async (e) => void outbox.push(e) },
});

const lastLink = (path: string) => {
  const match = outbox
    .at(-1)
    ?.text.match(new RegExp(`https?://[^\\s]+${path}\\?token=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error(`No ${path} link in the last email`);
  return match[1]!;
};

async function signup(username: string, email: string, password = "longenough") {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({ username, email, password }).expect(201);
  return agent;
}

beforeEach(() => {
  outbox.length = 0;
});

describe("email verification", () => {
  it("emails a link at signup that verifies the address once", async () => {
    const agent = await signup("tanner", "Tanner@Example.com");
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      to: "tanner@example.com",
      subject: "Verify your email for Chatty Chatter",
    });
    expect(outbox[0]!.html).toContain("https://chattychatter.com/verify-email?token=");

    const token = lastLink("/verify-email");
    await request(app).post("/api/auth/verify-email").send({ token }).expect(204);
    expect((await agent.get("/api/auth/me")).body).toMatchObject({
      email: "tanner@example.com",
      emailVerified: true,
    });
    // Single use.
    await request(app).post("/api/auth/verify-email").send({ token }).expect(400);
  });

  it("stores only a hash of the token", async () => {
    await signup("tanner", "tanner@example.com");
    const token = lastLink("/verify-email");
    const stored = await EmailTokenModel.findOne().lean();
    expect(stored?.tokenHash).not.toContain(token);
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects expired and made-up links", async () => {
    await signup("tanner", "tanner@example.com");
    const token = lastLink("/verify-email");
    await EmailTokenModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post("/api/auth/verify-email").send({ token }).expect(400);
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "x".repeat(43) })
      .expect(400);
    await request(app).post("/api/auth/verify-email").send({ token: "bad" }).expect(400);
  });

  it("can resend; the old link stops working", async () => {
    const agent = await signup("tanner", "tanner@example.com");
    const first = lastLink("/verify-email");
    await agent.post("/api/auth/resend-verification").expect(204);
    const second = lastLink("/verify-email");
    expect(second).not.toBe(first);
    await request(app).post("/api/auth/verify-email").send({ token: first }).expect(400);
    await request(app).post("/api/auth/verify-email").send({ token: second }).expect(204);
    await agent.post("/api/auth/resend-verification").expect(400);
  });
});

describe("emails on accounts", () => {
  it("rejects an email another account uses", async () => {
    await signup("tanner", "shared@example.com");
    await request(app)
      .post("/api/auth/signup")
      .send({ username: "ben", email: "SHARED@example.com", password: "longenough" })
      .expect(409);
  });

  it("lets an older account without an email add one, then re-verify after a change", async () => {
    await seedUser("oldtimer");
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "oldtimer", password: "password123" })
      .expect(200);
    expect((await agent.get("/api/auth/me")).body.email).toBeUndefined();

    const added = await agent
      .put("/api/users/me/email")
      .send({ email: "old@example.com" })
      .expect(200);
    expect(added.body).toMatchObject({ email: "old@example.com", emailVerified: false });
    const firstToken = lastLink("/verify-email");

    // Changing it again invalidates the first link.
    await agent.put("/api/users/me/email").send({ email: "new@example.com" }).expect(200);
    await request(app).post("/api/auth/verify-email").send({ token: firstToken }).expect(400);
    await request(app)
      .post("/api/auth/verify-email")
      .send({ token: lastLink("/verify-email") })
      .expect(204);
    expect((await agent.get("/api/auth/me")).body).toMatchObject({
      email: "new@example.com",
      emailVerified: true,
    });
  });

  it("keeps emails private", async () => {
    await signup("tanner", "tanner@example.com");
    const ben = await signup("ben", "ben@example.com");
    const { body } = await ben.get("/api/users/tanner").expect(200);
    expect(body).not.toHaveProperty("email");
    expect(body).not.toHaveProperty("emailVerified");
  });

  it("logs in with the email as well as the username", async () => {
    await signup("tanner", "tanner@example.com");
    await request(app)
      .post("/api/auth/login")
      .send({ username: "TANNER@example.com", password: "longenough" })
      .expect(200);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner", password: "longenough" })
      .expect(200);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner@example.com", password: "wrong" })
      .expect(401);
  });
});

describe("password reset", () => {
  it("only emails verified addresses, and answers the same either way", async () => {
    await signup("tanner", "tanner@example.com");
    outbox.length = 0;
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "tanner@example.com" })
      .expect(204);
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" })
      .expect(204);
    expect(outbox).toHaveLength(0); // tanner hasn't verified yet

    await UserModel.updateOne({ username: "tanner" }, { $set: { emailVerified: true } });
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "Tanner@Example.com" })
      .expect(204);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      to: "tanner@example.com",
      subject: "Reset your Chatty Chatter password",
    });
  });

  it("sets a new password once per link", async () => {
    await signup("tanner", "tanner@example.com", "original-pass");
    await UserModel.updateOne({ username: "tanner" }, { $set: { emailVerified: true } });
    await request(app).post("/api/auth/forgot-password").send({ email: "tanner@example.com" });
    const token = lastLink("/reset-password");

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "short" })
      .expect(400);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "brand-new-pass" })
      .expect(204);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "another-pass" })
      .expect(400);

    await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner", password: "original-pass" })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ username: "tanner", password: "brand-new-pass" })
      .expect(200);
  });
});
