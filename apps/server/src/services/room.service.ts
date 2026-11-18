import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import type { z } from "zod";
import type {
  ChatMessage,
  CreateRoomInput,
  MyRooms,
  Room,
  RoomSummary,
  sendMessageSchema,
} from "@chatty/shared";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import { RoomModel, type RoomFields } from "../models/room.model";
import { UserModel } from "../models/user.model";
import { hashPassword } from "./auth.service";

/** Older messages stay in the database but aren't sent when a room opens. */
const HISTORY_LIMIT = 300;
const SEARCH_LIMIT = 20;

type RoomRecord = Omit<RoomFields, "messageHistory"> & { _id: Types.ObjectId };
type NewMessage = z.output<typeof sendMessageSchema>;

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mongo stores missing optional strings as null; the API omits them.
const opt = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

export function toSummary(room: RoomRecord): RoomSummary {
  return {
    _id: room._id.toString(),
    room_number: room.room_number,
    room_name: opt(room.room_name),
    private_room: Boolean(room.private_room),
    created_by: room.created_by,
    room_category: opt(room.room_category),
    first_message: opt(room.first_message),
    users_in_room: room.users_in_room ?? [],
  };
}

interface MessageRecord {
  _id?: Types.ObjectId;
  message?: string | null;
  sentBy?: string | null;
  timestamp?: string | null;
  imageUrl?: string | null;
  cloudinary_id?: string | null;
  attachments?:
    | {
        url?: string | null;
        cloudinary_id?: string | null;
        width?: number | null;
        height?: number | null;
      }[]
    | null;
  mentions?: string[] | null;
  linkPreviewHidden?: boolean | null;
}

export function toMessage(m: MessageRecord): ChatMessage {
  return {
    _id: m._id?.toString(),
    message: m.message ?? "",
    sentBy: m.sentBy ?? "",
    timestamp: m.timestamp ?? "",
    imageUrl: opt(m.imageUrl),
    cloudinary_id: opt(m.cloudinary_id),
    ...(m.attachments?.length && {
      attachments: m.attachments.flatMap((a) =>
        a.url && a.cloudinary_id
          ? [
              {
                url: a.url,
                cloudinary_id: a.cloudinary_id,
                width: opt(a.width),
                height: opt(a.height),
              },
            ]
          : [],
      ),
    }),
    ...(m.mentions?.length && { mentions: m.mentions }),
    ...(m.linkPreviewHidden && { linkPreviewHidden: true }),
  };
}

// Every list query goes through here: lean, no message history, no password.
const findSummaries = (filter: Record<string, unknown>) =>
  RoomModel.find(filter).select("-messageHistory").lean<RoomRecord[]>();

async function findRoomRecord(roomNumber: number): Promise<RoomRecord> {
  const room = await RoomModel.findOne({ room_number: roomNumber })
    .select("-messageHistory")
    .lean<RoomRecord>();
  if (!room) throw notFound("Room not found");
  return room;
}

export async function joinedRoomNumbers(username: string): Promise<number[]> {
  const user = await UserModel.findOne({ username }, { roomsJoined: 1 }).lean();
  return (user?.roomsJoined ?? []).flatMap((r) => (r.room == null ? [] : [r.room]));
}

async function hasJoined(username: string, roomNumber: number): Promise<boolean> {
  return Boolean(await UserModel.exists({ username, "roomsJoined.room": roomNumber }));
}

/** Public rooms are open to everyone; private rooms to the creator and anyone who joined with the password. */
async function canAccess(username: string, room: RoomRecord): Promise<boolean> {
  if (!room.private_room || room.created_by === username) return true;
  return hasJoined(username, room.room_number);
}

export async function assertCanAccess(username: string, roomNumber: number): Promise<RoomSummary> {
  const room = await findRoomRecord(roomNumber);
  if (!(await canAccess(username, room))) throw forbidden("This room is private");
  return toSummary(room);
}

export async function getRoomWithHistory(username: string, roomNumber: number): Promise<Room> {
  const summary = await assertCanAccess(username, roomNumber);
  const room = await RoomModel.findOne({ room_number: roomNumber }, { messageHistory: 1 })
    .slice("messageHistory", -HISTORY_LIMIT)
    .lean();
  return { ...summary, messageHistory: (room?.messageHistory ?? []).map(toMessage) };
}

/** Basic details of any room, so the client can show a password prompt for a private one. */
export async function getRoomSummary(roomNumber: number): Promise<RoomSummary> {
  return toSummary(await findRoomRecord(roomNumber));
}

export async function isRoomNumberAvailable(roomNumber: number): Promise<boolean> {
  return !(await RoomModel.exists({ room_number: roomNumber }));
}

export async function searchRooms(name: string): Promise<RoomSummary[]> {
  const rooms = await findSummaries({
    room_name: { $regex: `^${escapeRegex(name)}`, $options: "i" },
  }).limit(SEARCH_LIMIT);
  return rooms.map(toSummary);
}

export async function getMyRooms(username: string): Promise<MyRooms> {
  const joinedNumbers = await joinedRoomNumbers(username);
  const [created, joined] = await Promise.all([
    findSummaries({ created_by: username }),
    findSummaries({ room_number: { $in: joinedNumbers }, created_by: { $ne: username } }),
  ]);
  return { created: created.map(toSummary), joined: joined.map(toSummary) };
}

export async function createRoom(username: string, input: CreateRoomInput): Promise<RoomSummary> {
  if (!(await isRoomNumberAvailable(input.roomNumber))) {
    throw conflict("That room number is taken");
  }
  const now = new Date();
  const date = now.toLocaleDateString("en-US");
  const room = await RoomModel.create({
    room_number: input.roomNumber,
    room_name: input.name,
    private_room: input.isPrivate,
    ...(input.isPrivate && { private_room_password: await hashPassword(input.password) }),
    created_by: username,
    room_category: input.category,
    first_message: `Created! on ${date}.`,
    messageHistory: [
      {
        message: `Room Created By ${username} on ${date}`,
        sentBy: username,
        timestamp: now.toISOString(),
      },
    ],
    users_in_room: [username],
  });
  await UserModel.updateOne(
    { username },
    {
      $push: {
        roomsCreated: {
          roomName: input.name,
          room: input.roomNumber,
          private: input.isPrivate,
          timestamp: now.toISOString(),
        },
      },
    },
  );
  return toSummary(room.toObject());
}

export async function joinRoom(
  username: string,
  roomNumber: number,
  password?: string,
): Promise<RoomSummary> {
  const room = await RoomModel.findOne({ room_number: roomNumber })
    .select("-messageHistory +private_room_password")
    .lean<RoomRecord>();
  if (!room) throw notFound("Room not found");
  if (room.created_by === username || (await hasJoined(username, roomNumber))) {
    return toSummary(room);
  }

  if (room.private_room) {
    if (!password) throw badRequest("This room needs a password");
    const matches = await bcrypt.compare(password, room.private_room_password ?? "");
    if (!matches) throw forbidden("Wrong room password");
  }

  await UserModel.updateOne(
    { username, "roomsJoined.room": { $ne: roomNumber } },
    {
      $push: {
        roomsJoined: {
          room: roomNumber,
          roomName: room.room_name,
          timestamp: new Date().toISOString(),
        },
      },
    },
  );
  return toSummary(room);
}

export async function leaveRoom(username: string, roomNumber: number): Promise<void> {
  await Promise.all([
    UserModel.updateOne({ username }, { $pull: { roomsJoined: { room: roomNumber } } }),
    RoomModel.updateOne({ room_number: roomNumber }, { $pull: { users_in_room: username } }),
  ]);
}

export async function deleteRoom(username: string, roomNumber: number): Promise<void> {
  const room = await findRoomRecord(roomNumber);
  if (room.created_by !== username) throw forbidden("Only the room's creator can delete it");
  await RoomModel.deleteOne({ _id: room._id });
  await Promise.all([
    UserModel.updateOne({ username }, { $pull: { roomsCreated: { room: roomNumber } } }),
    UserModel.updateMany(
      { "roomsJoined.room": roomNumber },
      { $pull: { roomsJoined: { room: roomNumber } } },
    ),
  ]);
}

/** Records that the user is in the room; used when their socket joins it. */
export async function markPresent(username: string, roomNumber: number): Promise<void> {
  await RoomModel.updateOne(
    { room_number: roomNumber },
    { $addToSet: { users_in_room: username } },
  );
}

/** Stores a message. `mentions` must already be checked (see message.service). */
export async function addMessage(
  username: string,
  input: NewMessage,
  mentions: string[] = [],
): Promise<ChatMessage> {
  const _id = new Types.ObjectId();
  const message = {
    _id,
    message: input.message,
    sentBy: username,
    timestamp: new Date().toISOString(),
    ...(input.attachments?.length && { attachments: input.attachments }),
    ...(mentions.length > 0 && { mentions }),
  };
  const result = await RoomModel.updateOne(
    { room_number: input.room },
    { $push: { messageHistory: message } },
  );
  if (result.matchedCount === 0) throw notFound("Room not found");
  return toMessage(message);
}

/** Removes a message's link preview for everyone. Only its sender may. */
export async function hideLinkPreview(
  username: string,
  roomNumber: number,
  messageId: string,
): Promise<void> {
  const result = await RoomModel.updateOne(
    {
      room_number: roomNumber,
      messageHistory: { $elemMatch: { _id: new Types.ObjectId(messageId), sentBy: username } },
    },
    { $set: { "messageHistory.$.linkPreviewHidden": true } },
  );
  if (result.matchedCount === 0) throw forbidden("You can only hide previews on your own messages");
}

/** Deletes a message for everyone. Only its sender may. */
export async function deleteMessage(
  username: string,
  roomNumber: number,
  messageId: string,
): Promise<string[]> {
  const _id = new Types.ObjectId(messageId);
  const before = await RoomModel.findOneAndUpdate(
    { room_number: roomNumber, messageHistory: { $elemMatch: { _id, sentBy: username } } },
    { $pull: { messageHistory: { _id } } },
    { projection: { messageHistory: { $elemMatch: { _id } } } },
  ).lean();
  if (!before) throw forbidden("You can only delete your own messages");
  // The deleted message's photos, so the caller can remove them from Cloudinary.
  return (before.messageHistory?.[0]?.attachments ?? []).flatMap((a) =>
    a.cloudinary_id ? [a.cloudinary_id] : [],
  );
}
