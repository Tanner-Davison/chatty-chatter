// Request schemas shared by apps/web (form validation) and apps/server
// (request + socket payload validation). The server never trusts a username
// sent by the client; identity always comes from the auth token.

import { z } from "zod";

export const USERNAME_PATTERN = /^[a-z0-9_.-]+$/;

/** Usernames are stored lowercase; signup normalizes before validating. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(USERNAME_PATTERN, "Use letters, numbers, dots, dashes or underscores");

// bcrypt only looks at the first 72 bytes.
const passwordSchema = z.string().max(72, "Password must be at most 72 characters");

export const signupSchema = z.object({
  username: usernameSchema,
  password: passwordSchema.min(8, "Password must be at least 8 characters"),
});
export type SignupInput = z.infer<typeof signupSchema>;

// Login stays lenient so accounts created before these rules still work.
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(64),
  password: passwordSchema.min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  profileBio: z.string().trim().max(500).optional(),
  education: z.string().trim().max(100).optional(),
  profession: z.string().trim().max(100).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const roomNumberSchema = z.coerce
  .number()
  .int("Room number must be a whole number")
  .positive("Room number must be positive")
  .max(Number.MAX_SAFE_INTEGER);

export const roomNumberParamsSchema = z.object({ roomNumber: roomNumberSchema });

export const usernameParamsSchema = z.object({ username: z.string().trim().min(1).max(64) });

const roomPasswordSchema = z
  .string()
  .min(4, "Room password must be at least 4 characters")
  .max(72, "Room password must be at most 72 characters");

const roomBaseSchema = z.object({
  roomNumber: roomNumberSchema,
  name: z.string().trim().min(1, "Give the room a name").max(50),
  category: z.string().trim().max(30).optional(),
});

export const createRoomSchema = z.discriminatedUnion("isPrivate", [
  roomBaseSchema.extend({ isPrivate: z.literal(false) }),
  roomBaseSchema.extend({ isPrivate: z.literal(true), password: roomPasswordSchema }),
]);
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  password: z.string().max(72).optional(),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const searchRoomsQuerySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

// Socket.IO payloads

export const MESSAGE_MAX_LENGTH = 500;

export const roomEventSchema = z.object({ room: roomNumberSchema });
export type RoomEventPayload = z.infer<typeof roomEventSchema>;

export const sendMessageSchema = z
  .object({
    room: roomNumberSchema,
    message: z.string().trim().max(MESSAGE_MAX_LENGTH).default(""),
    imageUrl: z.url({ protocol: /^https$/ }).optional(),
    cloudinary_id: z.string().max(200).optional(),
  })
  .refine((m) => m.message.length > 0 || m.imageUrl, {
    message: "A message needs text or an image",
  });
export type SendMessageInput = z.input<typeof sendMessageSchema>;

export const ROOM_CATEGORIES = [
  "General",
  "Discussions",
  "Technology",
  "Entertainment",
  "Gaming",
  "Sports",
  "Books and Literature",
  "Travel",
  "Food and Cooking",
  "Health and Fitness",
  "Art and Creativity",
  "Science and Nature",
  "Politics and News",
  "Education",
  "Parenting",
  "Music and Instruments",
] as const;
export type RoomCategory = (typeof ROOM_CATEGORIES)[number];

export const DISCOVER_SORTS = ["trending", "active", "members", "newest"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export const discoverQuerySchema = z.object({
  category: z.enum(ROOM_CATEGORIES).optional(),
  sort: z.enum(DISCOVER_SORTS).default("trending"),
  q: z.string().trim().max(50).optional(),
});
export type DiscoverQuery = z.input<typeof discoverQuerySchema>;
