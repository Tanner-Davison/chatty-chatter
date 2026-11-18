// Socket.IO event contract between apps/web and apps/server. The socket
// authenticates with a short-lived token from GET /api/auth/socket-token, so
// payloads never carry a username.

import type { ChatMessage } from "./models";
import type { RoomEventPayload, SendMessageInput } from "./schemas";

export type Ack<T = undefined> = (
  response: { ok: true; data: T } | { ok: false; error: string },
) => void;

export interface ClientToServerEvents {
  join_room: (payload: RoomEventPayload, ack: Ack) => void;
  leave_room: (payload: RoomEventPayload) => void;
  send_message: (payload: SendMessageInput, ack: Ack<ChatMessage>) => void;
  typing: (payload: RoomEventPayload) => void;
}

export interface ServerToClientEvents {
  receive_message: (payload: { room: number; message: ChatMessage }) => void;
  sender_is_typing: (payload: { room: number; username: string }) => void;
}

export interface SocketData {
  username: string;
}
