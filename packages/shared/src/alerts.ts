import { z } from "zod";
import type { Notification } from "./models";

/** A notification as a one-line alert, for pop-ups and alert emails. */
export interface AlertText {
  title: string;
  body: string;
  /** Where clicking it goes, as an app path. */
  url: string;
  /**
   * Alerts with the same tag replace each other, so ten mentions in one hub
   * show as one pop-up instead of ten.
   */
  tag: string;
}

const hubName = (n: { room: number; roomName?: string }) => n.roomName ?? `Hub #${n.room}`;

export function alertText(n: Notification): AlertText {
  switch (n.type) {
    case "mention":
      return {
        title: `@${n.sentBy} mentioned you in ${hubName(n)}`,
        body: n.preview,
        url: `/chatroom/${n.room}?m=${n.messageId}`,
        tag: `room-${n.room}`,
      };
    case "friend_request":
      return {
        title: `@${n.sentBy} sent you a friend request`,
        body: "Accept or decline it in Chatty Chatter.",
        url: `/profile/${n.sentBy}`,
        tag: "friends",
      };
    case "friend_accepted":
      return {
        title: `@${n.sentBy} accepted your friend request`,
        body: "You're now friends.",
        url: `/profile/${n.sentBy}`,
        tag: "friends",
      };
    case "room_added":
      return {
        title: `@${n.sentBy} added you to ${hubName(n)}`,
        body: "It's in your hubs now.",
        url: `/chatroom/${n.room}`,
        tag: `room-${n.room}`,
      };
  }
}

/** What the browser hands over when a device subscribes to pop-ups. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushEndpointSchema = z.object({ endpoint: z.url().max(1000) });

export const alertSettingsSchema = z.object({ emailAlerts: z.boolean() });
export type AlertSettingsInput = z.infer<typeof alertSettingsSchema>;

export const unsubscribeSchema = z.object({ token: z.string().min(1).max(500) });

/** The server's public VAPID key, or null when pop-ups aren't set up. */
export interface PushConfig {
  publicKey: string | null;
}
