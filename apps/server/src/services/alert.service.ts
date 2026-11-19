import { alertText, type Notification, type PushSubscriptionInput } from "@chatty/shared";
import type { Env } from "../config/env";
import * as emails from "../lib/emails";
import { badRequest, notFound } from "../lib/http-error";
import type { Mailer } from "../lib/mailer";
import type { Notifier } from "../lib/notifier";
import type { Presence } from "../lib/presence";
import type { Pusher } from "../lib/push";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "../lib/tokens";
import { NotificationModel } from "../models/notification.model";
import { PushSubscriptionModel } from "../models/push-subscription.model";
import { UserModel, type UserDocument } from "../models/user.model";
import { toNotification } from "./notification.service";

// Alerts reach people who aren't looking at the app, without nagging them:
//
// - Pop-ups go to devices that turned them on, only while the user has no tab
//   open (an open tab already shows the bell). Repeats from one hub replace
//   each other instead of stacking up.
// - Emails wait until a notification has sat unread for EMAIL_DELAY, then
//   bundle everything unread into one email. After that, no more emails until
//   the user comes back, however much piles up.

/** How long a notification sits unread before it's worth an email. */
export const EMAIL_DELAY_MS = 15 * 60 * 1000;
/** Older unread notifications are stale; never email about them. */
const EMAIL_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 5 * 60 * 1000;
const MAX_LISTED = 5;

// ---- Pop-ups (Web Push) ----

/** Remembers a device that turned on pop-ups. A device belongs to whoever subscribed last. */
export async function addPushSubscription(username: string, sub: PushSubscriptionInput) {
  await PushSubscriptionModel.updateOne(
    { endpoint: sub.endpoint },
    { $set: { username, ...sub.keys } },
    { upsert: true },
  );
}

export async function removePushSubscription(username: string, endpoint: string) {
  await PushSubscriptionModel.deleteOne({ username, endpoint });
}

/** Sends a pop-up to every device the user turned them on for, forgetting dead ones. */
export async function push(pusher: Pusher, username: string, notification: Notification) {
  if (!pusher.publicKey) return;
  const subs = await PushSubscriptionModel.find({ username }).lean();
  if (subs.length === 0) return;
  const payload = JSON.stringify(alertText(notification));
  await Promise.all(
    subs.map(async (sub) => {
      const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      const alive = await pusher.send(target, payload).catch((err: unknown) => {
        console.error("Couldn't send a pop-up", err);
        return true;
      });
      if (!alive) await PushSubscriptionModel.deleteOne({ _id: sub._id });
    }),
  );
}

/** Live delivery to open tabs, plus a pop-up when the user has none open. */
export function withPush(live: Notifier, pusher: Pusher, presence: Presence): Notifier {
  return {
    send(recipient, notification) {
      live.send(recipient, notification);
      if (!presence.isOnline(recipient)) void push(pusher, recipient, notification);
    },
    changed: (recipient) => live.changed(recipient),
  };
}

// ---- Email ----

export async function setEmailAlerts(username: string, on: boolean): Promise<UserDocument> {
  const user = await UserModel.findOneAndUpdate(
    { username },
    { $set: { emailAlerts: on } },
    { returnDocument: "after" },
  );
  if (!user) throw notFound("User not found");
  return user;
}

/** The link at the bottom of alert emails; works without logging in. */
export async function unsubscribe(env: Env, token: string) {
  const username = verifyUnsubscribeToken(env.JWT_SECRET, token);
  if (!username) throw badRequest("This unsubscribe link isn't valid");
  await UserModel.updateOne({ username }, { $set: { emailAlerts: false } });
}

/** Records that the user is using the app, which re-arms alert emails. */
export async function markActive(username: string, at = new Date()) {
  await UserModel.updateOne({ username }, { $set: { lastActiveAt: at } });
}

const later = (...dates: (Date | null | undefined)[]) =>
  new Date(Math.max(...dates.map((d) => d?.getTime() ?? 0)));

/** Emails everyone who's due an alert email. Returns how many were sent. */
export async function sendAlertEmails(
  env: Env,
  mailer: Mailer,
  presence: Presence,
  now = new Date(),
): Promise<number> {
  const ready = new Date(now.getTime() - EMAIL_DELAY_MS);
  const recipients: string[] = await NotificationModel.distinct("recipient", {
    read: false,
    createdAt: { $gte: new Date(now.getTime() - EMAIL_LOOKBACK_MS), $lte: ready },
  });

  let sent = 0;
  for (const username of recipients) {
    if (presence.isOnline(username)) continue;
    const user = await UserModel.findOne(
      { username, emailVerified: true, email: { $type: "string" }, emailAlerts: { $ne: false } },
      { email: 1, alertEmailedAt: 1, lastActiveAt: 1 },
    ).lean();
    if (!user?.email) continue;
    // One email, then quiet until they've been back.
    if (user.alertEmailedAt && !(user.lastActiveAt && user.lastActiveAt > user.alertEmailedAt))
      continue;

    // Anything from before their last visit, they've had the chance to see.
    const since = later(
      user.alertEmailedAt,
      user.lastActiveAt,
      new Date(now.getTime() - EMAIL_LOOKBACK_MS),
    );
    const due = await NotificationModel.exists({
      recipient: username,
      read: false,
      createdAt: { $gt: since, $lte: ready },
    });
    if (!due) continue;

    // Claim the send, so two overlapping runs can't both email.
    const claimed = await UserModel.updateOne(
      { _id: user._id, alertEmailedAt: user.alertEmailedAt ?? null },
      { $set: { alertEmailedAt: now } },
    );
    if (claimed.modifiedCount === 0) continue;

    // Include anything newer too, now that an email is going anyway.
    const all = await NotificationModel.find({
      recipient: username,
      read: false,
      createdAt: { $gt: since },
    })
      .sort({ createdAt: -1 })
      .lean();
    const alerts = all.map((n) => alertText(toNotification(n)));
    const token = signUnsubscribeToken(env.JWT_SECRET, username);
    try {
      await mailer.send({
        to: user.email,
        ...emails.alertDigest(username, alerts.slice(0, MAX_LISTED), alerts.length, env.APP_URL, {
          unsubscribe: `${env.APP_URL}/unsubscribe?token=${token}`,
        }),
        idempotencyKey: `alert-${username}-${now.getTime()}`,
        headers: {
          // One-click unsubscribe from the mail app (RFC 8058).
          "List-Unsubscribe": `<${env.APP_URL}/api/alerts/unsubscribe?token=${token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch (err) {
      console.error(`Couldn't send an alert email to @${username}`, err);
      // Try again next time round.
      await UserModel.updateOne(
        { _id: user._id, alertEmailedAt: now },
        user.alertEmailedAt
          ? { $set: { alertEmailedAt: user.alertEmailedAt } }
          : { $unset: { alertEmailedAt: "" } },
      );
    }
  }
  return sent;
}

/** Checks for due alert emails every few minutes. Returns a function that stops it. */
export function startAlertEmails(env: Env, mailer: Mailer, presence: Presence): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    sendAlertEmails(env, mailer, presence)
      .catch((err: unknown) => console.error("Alert emails failed", err))
      .finally(() => (running = false));
  }, CHECK_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
