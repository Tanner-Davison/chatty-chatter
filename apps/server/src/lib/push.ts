import webpush from "web-push";
import type { Env } from "../config/env";

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Sends Web Push messages to browsers. */
export interface Pusher {
  /** The VAPID public key browsers subscribe with, or null when push is off. */
  publicKey: string | null;
  /** Resolves to false when the subscription is gone and should be forgotten. */
  send(target: PushTarget, payload: string): Promise<boolean>;
}

/** For tests and servers without VAPID keys. */
export const noPusher: Pusher = { publicKey: null, send: async () => true };

export function createPusher(env: Env): Pusher {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return noPusher;
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    async send(target, payload) {
      try {
        // An alert that's a day late isn't worth showing.
        await webpush.sendNotification(target, payload, { vapidDetails, TTL: 24 * 60 * 60 });
        return true;
      } catch (err) {
        // The browser unsubscribed or the subscription expired.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return false;
        throw err;
      }
    },
  };
}
