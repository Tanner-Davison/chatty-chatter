// Socket.IO event contract between apps/web and apps/server. The socket
// authenticates with a short-lived token from GET /api/auth/socket-token, so
// payloads never carry a username.

import type { ChatMessage, Notification } from "./models";
import type {
  HideLinkPreviewInput,
  MessageRef,
  RoomEventPayload,
  SendMessageInput,
} from "./schemas";

export type Ack<T = undefined> = (
  response: { ok: true; data: T } | { ok: false; error: string },
) => void;

export interface ClientToServerEvents {
  join_room: (payload: RoomEventPayload, ack: Ack) => void;
  leave_room: (payload: RoomEventPayload) => void;
  send_message: (payload: SendMessageInput, ack: Ack<ChatMessage>) => void;
  typing: (payload: RoomEventPayload) => void;
  /** Only the sender may remove a message's link preview for everyone. */
  hide_link_preview: (payload: HideLinkPreviewInput, ack: Ack) => void;
  /** Only the sender may delete a message; it disappears for everyone. */
  delete_message: (payload: MessageRef, ack: Ack) => void;
}

export interface ServerToClientEvents {
  receive_message: (payload: { room: number; message: ChatMessage }) => void;
  sender_is_typing: (payload: { room: number; username: string }) => void;
  message_updated: (payload: {
    room: number;
    messageId: string;
    linkPreviewHidden: boolean;
  }) => void;
  /** Sent only to the user it's for. */
  notification: (payload: Notification) => void;
  message_deleted: (payload: MessageRef) => void;
  /** The user's notifications changed (e.g. one was removed); refetch them. */
  notifications_changed: () => void;
}

export interface SocketData {
  username: string;
}
