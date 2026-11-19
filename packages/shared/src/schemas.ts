// Request schemas shared by apps/web (form validation) and apps/server
// (request + socket payload validation). The server never trusts a username
// sent by the client; identity always comes from the auth token.

import { z } from "zod";
import { RECEIVED_COLORS, SENT_COLORS } from "./preferences";

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

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

const newPasswordSchema = passwordSchema.min(8, "Password must be at least 8 characters");

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

// Login stays lenient so accounts created before these rules still work.
// `username` may also be the account's email address.
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username or email").max(254),
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
  // A private hub without a password is invite-only: people get in by link or by being added.
  roomBaseSchema.extend({ isPrivate: z.literal(true), password: roomPasswordSchema.optional() }),
]);
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  password: z.string().max(72).optional(),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

/** The random code in a hub's invite link. */
export const inviteCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, "This invite link is invalid");

export const inviteCodeParamsSchema = z.object({ code: inviteCodeSchema });

export const addMemberSchema = z.object({ username: usernameSchema });
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const searchRoomsQuerySchema = z.object({
  name: z.string().trim().min(1).max(50),
});

// Socket.IO payloads

/** Long enough to share a code template. */
export const MESSAGE_MAX_LENGTH = 4000;

export const roomEventSchema = z.object({ room: roomNumberSchema });
export type RoomEventPayload = z.infer<typeof roomEventSchema>;

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const attachmentSchema = z.object({
  url: z.url({ protocol: /^https$/ }).max(500),
  cloudinary_id: z.string().min(1).max(200),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

/** GIPHY serves GIFs from these hosts; nothing else may be embedded as a GIF. */
export const isGiphyMediaUrl = (url: string) =>
  /^https:\/\/(media\d*|i)\.giphy\.com\/[^\s]*$/.test(url);

export const gifSchema = z.object({
  id: z.string().min(1).max(100),
  url: z
    .url({ protocol: /^https$/ })
    .max(500)
    .refine(isGiphyMediaUrl, "GIFs must come from GIPHY"),
  width: z.number().int().positive().max(2000),
  height: z.number().int().positive().max(2000),
  title: z.string().max(200).optional(),
});

export const sendMessageSchema = z
  .object({
    room: roomNumberSchema,
    message: z.string().trim().max(MESSAGE_MAX_LENGTH).default(""),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
    gif: gifSchema.optional(),
  })
  .refine((m) => m.message.length > 0 || (m.attachments?.length ?? 0) > 0 || m.gif, {
    message: "A message needs text, a photo or a GIF",
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

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");

/** Points at one message in a room. */
export const messageRefSchema = z.object({ room: roomNumberSchema, messageId: objectIdSchema });
export type MessageRef = z.infer<typeof messageRefSchema>;

export const hideLinkPreviewSchema = messageRefSchema;
export type HideLinkPreviewInput = MessageRef;

export const linkPreviewQuerySchema = z.object({
  url: z.url({ protocol: /^https?$/ }).max(2000),
});

export const gifSearchQuerySchema = z.object({
  /** Empty for trending GIFs. */
  q: z.string().trim().max(100).default(""),
  offset: z.coerce.number().int().min(0).max(4999).default(0),
});

export const markNotificationsReadSchema = z.object({
  /** Omit to mark everything read. */
  ids: z.array(objectIdSchema).max(100).optional(),
});

/** null resets a colour to the default. */
export const roomPreferencesSchema = z.object({
  sentColor: z.enum(SENT_COLORS).nullable().optional(),
  receivedColor: z.enum(RECEIVED_COLORS).nullable().optional(),
});
export type RoomPreferencesInput = z.infer<typeof roomPreferencesSchema>;

// Email verification and password reset

/** The random token from an emailed link. */
export const emailTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, "This link is invalid");

export const verifyEmailSchema = z.object({ token: emailTokenSchema });

export const updateEmailSchema = z.object({ email: emailSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: emailTokenSchema,
  password: newPasswordSchema,
});
