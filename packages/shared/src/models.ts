// Shapes of the documents the API returns today. They mirror the Mongoose
// schemas in apps/server/utils/Schemas.js and keep their field names so live
// data needs no migration.

export interface ProfilePic {
  url: string;
  cloudinary_id: string;
}

export interface RoomRef {
  room: number;
  roomName?: string;
  timestamp?: string;
}

export interface CreatedRoomRef extends RoomRef {
  private?: boolean;
}

export interface SentMessageRef {
  message: string;
  room: number;
  timestamp: string;
}

/** A user as returned by the API. The password hash is never sent. */
export interface User {
  _id: string;
  username: string;
  profilePic?: ProfilePic;
  sentMessages: SentMessageRef[];
  roomsJoined: RoomRef[];
  roomsCreated: CreatedRoomRef[];
  friends: string[];
  profileBio?: string;
  education?: string;
  profession?: string;
}

export interface ChatMessage {
  message: string;
  sentBy: string;
  timestamp: string;
  imageUrl?: string;
  cloudinary_id?: string;
}

export interface Room {
  _id: string;
  room_number: number;
  room_name?: string;
  private_room?: boolean;
  created_by: string;
  room_category?: string;
  first_message?: string;
  messageHistory: ChatMessage[];
  users_in_room: string[];
}
