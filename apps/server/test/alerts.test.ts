import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { Notification } from "@chatty/shared";
import { createApp } from "../src/app";
import type { Email } from "../src/lib/mailer";
import type { Presence } from "../src/lib/presence";
import type { Pusher } from "../src/lib/push";
import { NotificationModel } from "../src/models/notification.model";
import { PushSubscriptionModel } from "../src/models/push-subscription.model";
import { UserModel } from "../src/models/user.model";
import {
  EMAIL_DELAY_MS,
  markActive,
  sendAlertEmails,
  withPush,
} from "../src/services/alert.service";
import { createNotification } from "../src/services/notification.service";
import { env, loginAs, seedUser, uploadedPic } from "./helpers";

const outbox: Email[] = [];
const mailer = { send: async (e: Email) => void outbox.push(e) };
const online = new Set<string>();
const presence: Presence = {
  onlineCounts: () => new Map(),
  isOnline: (u) => online.has(u),
};

const minutes = (n: number) => n * 60 * 1000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);
/** Runs the email check as if `offsetMs` had passed. */
const runAt = (offsetMs: number) => sendAlertEmails(env, mailer, presence, at(offsetMs));

async function seedVerified(username: string) {
  const user = await seedUser(username);
  user.email = `${username}@example.com`;
  user.emailVerified = true;
  await user.save();
  return user;
}

/** Moves a notification's creation time (Mongoose won't update `createdAt`). */
const arrivedAt = (n: Notification, when: Date) =>
  NotificationModel.collection.updateOne(
    { _id: new Types.ObjectId(n._id) },
    { $set: { createdAt: when } },
  );

const mention = (recipient: string, sentBy = "ben") =>
  createNotification({
    recipient,
    sentBy,
    type: "mention",
    room: 7,
    roomName: "lounge",
    messageId: "m1",
    preview: `hey @${recipient}`,
  });

beforeEach(async () => {
  outbox.length = 0;
  online.clear();
  await seedVerified("tanner");
});

describe("alert emails", () => {
  it("waits before emailing about an unread notification", async () => {
    await mention("tanner");
    expect(await runAt(minutes(5))).toBe(0);
    expect(await runAt(EMAIL_DELAY_MS + minutes(1))).toBe(1);
    expect(outbox[0]).toMatchObject({
      to: "tanner@example.com",
      subject: "@ben mentioned you in lounge",
    });
    expect(outbox[0]!.text).toContain("https://chattychatter.com/chatroom/7?m=m1");
    expect(outbox[0]!.text).toContain("https://chattychatter.com/unsubscribe?token=");
    expect(outbox[0]!.headers?.["List-Unsubscribe"]).toMatch(
      /^<https:\/\/chattychatter\.com\/api\/alerts\/unsubscribe\?token=.+>$/,
    );
  });

  it("bundles everything unread into one email", async () => {
    await mention("tanner", "ben");
    await mention("tanner", "sam");
    await runAt(EMAIL_DELAY_MS + minutes(1));
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toBe("You have 2 new notifications on Chatty Chatter");
  });

  it("sends one email, then nothing more until the user comes back", async () => {
    await mention("tanner");
    await runAt(EMAIL_DELAY_MS + minutes(1));
    const next = await mention("tanner", "sam");
    await arrivedAt(next, at(EMAIL_DELAY_MS + minutes(2)));
    expect(await runAt(EMAIL_DELAY_MS * 4)).toBe(0);
    expect(await runAt(EMAIL_DELAY_MS * 40)).toBe(0);
    expect(outbox).toHaveLength(1);
  });

  it("emails again about things that happen after the user's last visit", async () => {
    await mention("tanner");
    await runAt(EMAIL_DELAY_MS + minutes(1));
    expect(outbox).toHaveLength(1);
    // They visit after the email went out, then a new mention arrives.
    await markActive("tanner", at(EMAIL_DELAY_MS + minutes(2)));
    const later = await mention("tanner", "sam");
    await arrivedAt(later, at(EMAIL_DELAY_MS + minutes(3)));
    expect(await runAt(EMAIL_DELAY_MS * 2 + minutes(4))).toBe(1);
    expect(outbox[1]!.subject).toBe("@sam mentioned you in lounge");
  });

  it("doesn't email about what happened before the user's last visit", async () => {
    await mention("tanner");
    await markActive("tanner", at(minutes(1)));
    expect(await runAt(EMAIL_DELAY_MS + minutes(2))).toBe(0);
  });

  it("skips read notifications, people online, and unverified or opted-out accounts", async () => {
    const n = await mention("tanner");
    await NotificationModel.updateOne({ _id: n._id }, { $set: { read: true } });
    expect(await runAt(EMAIL_DELAY_MS + minutes(1))).toBe(0);

    await mention("tanner");
    online.add("tanner");
    expect(await runAt(EMAIL_DELAY_MS + minutes(1))).toBe(0);
    online.clear();

    await UserModel.updateOne({ username: "tanner" }, { $set: { emailAlerts: false } });
    expect(await runAt(EMAIL_DELAY_MS + minutes(1))).toBe(0);

    await seedUser("ben");
    await UserModel.updateOne({ username: "ben" }, { $set: { email: "ben@example.com" } });
    await mention("ben", "tanner");
    expect(await runAt(EMAIL_DELAY_MS + minutes(1))).toBe(0);
    expect(outbox).toHaveLength(0);
  });

  it("tries again next time if the email fails", async () => {
    await mention("tanner");
    let fail = true;
    const flaky = {
      send: async (e: Email) => {
        if (fail) throw new Error("Resend is down");
        outbox.push(e);
      },
    };
    expect(await sendAlertEmails(env, flaky, presence, at(EMAIL_DELAY_MS + minutes(1)))).toBe(0);
    fail = false;
    expect(await sendAlertEmails(env, flaky, presence, at(EMAIL_DELAY_MS + minutes(6)))).toBe(1);
  });
});

describe("alert settings", () => {
  const app = createApp({ env, uploadImage: async () => uploadedPic });

  it("turns alert emails on and off, visible only to the owner", async () => {
    const agent = await loginAs("tanner");
    expect((await agent.get("/api/auth/me")).body.emailAlerts).toBe(true);
    const res = await agent.put("/api/users/me/alerts").send({ emailAlerts: false }).expect(200);
    expect(res.body.emailAlerts).toBe(false);

    await seedUser("ben");
    const ben = await loginAs("ben");
    const profile = (await ben.get("/api/users/tanner")).body;
    expect(profile).not.toHaveProperty("emailAlerts");
    expect(profile).not.toHaveProperty("lastActiveAt");
  });

  it("unsubscribes from the email link and from one-click mail apps", async () => {
    await mention("tanner");
    await runAt(EMAIL_DELAY_MS + minutes(1));
    const token = outbox[0]!.text.match(/unsubscribe\?token=([\w.-]+)/)![1]!;

    await request(app).post("/api/alerts/unsubscribe").send({ token }).expect(204);
    expect((await UserModel.findOne({ username: "tanner" }).lean())?.emailAlerts).toBe(false);

    await UserModel.updateOne({ username: "tanner" }, { $set: { emailAlerts: true } });
    await request(app)
      .post(`/api/alerts/unsubscribe?token=${token}`)
      .type("form")
      .send("List-Unsubscribe=One-Click")
      .expect(204);
    expect((await UserModel.findOne({ username: "tanner" }).lean())?.emailAlerts).toBe(false);
  });

  it("rejects made-up unsubscribe tokens", async () => {
    await request(app).post("/api/alerts/unsubscribe").send({ token: "nope" }).expect(400);
  });
});

describe("pop-up alerts", () => {
  const sub = {
    endpoint: "https://push.example.com/device-1",
    keys: { p256dh: "BPublicKey", auth: "secret" },
  };

  it("remembers and forgets a device's subscription", async () => {
    const agent = await loginAs("tanner");
    await agent.post("/api/push/subscriptions").send(sub).expect(204);
    // Subscribing again (or as someone else on the same browser) doesn't duplicate.
    await agent.post("/api/push/subscriptions").send(sub).expect(204);
    expect(await PushSubscriptionModel.countDocuments()).toBe(1);
    await agent.delete("/api/push/subscriptions").send({ endpoint: sub.endpoint }).expect(204);
    expect(await PushSubscriptionModel.countDocuments()).toBe(0);
  });

  it("says when pop-ups aren't set up on the server", async () => {
    const res = await request(createApp({ env, uploadImage: async () => uploadedPic }))
      .get("/api/push/config")
      .expect(200);
    expect(res.body).toEqual({ publicKey: null });
  });

  it("pops up only when the user has no tab open, and drops dead devices", async () => {
    await PushSubscriptionModel.create([
      { username: "tanner", endpoint: "https://push.example.com/a", p256dh: "k", auth: "a" },
      { username: "tanner", endpoint: "https://push.example.com/gone", p256dh: "k", auth: "a" },
    ]);
    const pushed: { endpoint: string; payload: string }[] = [];
    const pusher: Pusher = {
      publicKey: "key",
      send: async (target, payload) => {
        pushed.push({ endpoint: target.endpoint, payload });
        return !target.endpoint.endsWith("/gone");
      },
    };
    const live: Notification[] = [];
    const notifier = withPush(
      { send: (_to, n) => live.push(n), changed: () => {} },
      pusher,
      presence,
    );

    online.add("tanner");
    notifier.send("tanner", await mention("tanner"));
    await new Promise((r) => setTimeout(r, 50));
    expect(live).toHaveLength(1);
    expect(pushed).toHaveLength(0);

    online.clear();
    notifier.send("tanner", await mention("tanner"));
    await new Promise((r) => setTimeout(r, 50));
    expect(pushed).toHaveLength(2);
    expect(JSON.parse(pushed[0]!.payload)).toMatchObject({
      title: "@ben mentioned you in lounge",
      url: "/chatroom/7?m=m1",
      tag: "room-7",
    });
    expect(await PushSubscriptionModel.countDocuments()).toBe(1);
  });
});
