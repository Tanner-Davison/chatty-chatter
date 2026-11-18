// Shapes the API returns. They keep the Mongoose field names so live data needs
// no migration. Password hashes (user and private room) are never sent.

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

/** A user's public profile. */
export interface User {
  _id: string;
  username: string;
  profilePic?: ProfilePic;
  roomsJoined: RoomRef[];
  roomsCreated: CreatedRoomRef[];
  friends: string[];
  profileBio?: string;
  education?: string;
  profession?: string;
}

/**
 * `timestamp` is an ISO 8601 string for messages sent after the Phase 2
 * rewrite. Older messages hold whatever the old client formatted, such as
 * "11/26 12:44 am", so display code must fall back to the raw string.
 */
export interface ChatMessage {
  _id?: string;
  message: string;
  sentBy: string;
  timestamp: string;
  imageUrl?: string;
  cloudinary_id?: string;
}

/** A room in a list: no message history. */
export interface RoomSummary {
  _id: string;
  room_number: number;
  room_name?: string;
  private_room: boolean;
  created_by: string;
  room_category?: string;
  first_message?: string;
  users_in_room: string[];
}

/** A room the current user may read, with its messages. */
export interface Room extends RoomSummary {
  messageHistory: ChatMessage[];
}

export interface MyRooms {
  created: RoomSummary[];
  joined: RoomSummary[];
}

export interface ApiError {
  error: string;
  /** Field-level messages from request validation. */
  issues?: Record<string, string[]>;
}
