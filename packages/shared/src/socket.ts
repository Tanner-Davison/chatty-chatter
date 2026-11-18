// Socket.IO event contract between apps/web and apps/server.

export interface JoinRoomPayload {
  room: number;
  username: string;
}

export interface SendMessagePayload {
  room: number;
  username: string;
  message: string;
  timestamp: string;
  imageUrl?: string;
  cloudinary_id?: string;
}

export interface TypingPayload {
  room: number;
  username: string;
}

export interface ClientToServerEvents {
  join_room: (payload: JoinRoomPayload) => void;
  send_message: (payload: SendMessagePayload) => void;
  typing: (payload: TypingPayload) => void;
  leaveroom: (room: number) => void;
}

export interface ServerToClientEvents {
  receive_message: (payload: SendMessagePayload) => void;
  sender_is_typing: (username: string) => void;
}
