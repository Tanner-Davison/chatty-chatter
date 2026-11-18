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
  /** Usernames this message notified. */
  mentions?: string[];
  /** The sender removed the link preview for everyone. */
  linkPreviewHidden?: boolean;
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

/** A room on the explore page, with activity worked out by the server. */
export interface DiscoverRoom extends RoomSummary {
  /** ISO time the room was created (from its id). */
  createdAt: string;
  /** ISO time of the newest message, or of creation if there are none. */
  lastActiveAt: string;
  messageCount: number;
  /** Messages in the last 24 hours. */
  recentMessageCount: number;
  /** People with the room open right now. */
  onlineCount: number;
  /** Never set for private rooms. */
  lastMessage?: { message: string; sentBy: string };
  /** Up to four member usernames, for avatar stacks. */
  memberPreview: string[];
  /** Friends of the viewer who created or joined the room. */
  friendsHere?: string[];
  /** The viewer's relationship to the room. */
  membership: "owner" | "joined" | "none";
}

/** A quick look inside a room without joining it. Private rooms the viewer can't open have no messages. */
export interface RoomPeek {
  room: DiscoverRoom;
  locked: boolean;
  messages: ChatMessage[];
}

export interface Notification {
  _id: string;
  type: "mention";
  room: number;
  roomName?: string;
  messageId: string;
  sentBy: string;
  /** The start of the message. */
  preview: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

/** What a link unfurls to. Every field is optional because pages vary. */
export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}
