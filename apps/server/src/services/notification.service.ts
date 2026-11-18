import type { Types } from "mongoose";
import type { ChatMessage, Notification, NotificationList } from "@chatty/shared";
import { NotificationModel, type NotificationFields } from "../models/notification.model";
import { RoomModel } from "../models/room.model";
import { UserModel } from "../models/user.model";

const LIST_LIMIT = 30;
const PREVIEW_LENGTH = 140;

type NotificationRecord = NotificationFields & { _id: Types.ObjectId; createdAt: Date };

function toNotification(n: NotificationRecord): Notification {
  return {
    _id: n._id.toString(),
    type: n.type,
    room: n.room,
    roomName: n.roomName ?? undefined,
    messageId: n.messageId,
    sentBy: n.sentBy,
    preview: n.preview,
    read: n.read ?? false,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Narrows mentioned usernames to real users, other than the sender, who can
 * see the room: anyone for a public room, the creator and members for a
 * private one. Nobody learns about a private room through a mention.
 */
export async function resolveMentions(
  sender: string,
  roomNumber: number,
  candidates: string[],
): Promise<string[]> {
  const wanted = candidates.filter((u) => u !== sender);
  if (wanted.length === 0) return [];
  const room = await RoomModel.findOne(
    { room_number: roomNumber },
    { private_room: 1, created_by: 1 },
  ).lean();
  if (!room) return [];

  const users = await UserModel.find(
    {
      username: { $in: wanted },
      ...(room.private_room && {
        $or: [{ username: room.created_by }, { "roomsJoined.room": roomNumber }],
      }),
    },
    { username: 1 },
  ).lean();
  const valid = new Set(users.map((u) => u.username));
  return wanted.filter((u) => valid.has(u));
}

/** Creates one notification per mentioned user and returns them for live delivery. */
export async function notifyMentions(
  roomNumber: number,
  message: ChatMessage,
): Promise<(Notification & { recipient: string })[]> {
  if (!message.mentions?.length || !message._id) return [];
  const room = await RoomModel.findOne({ room_number: roomNumber }, { room_name: 1 }).lean();
  const docs = await NotificationModel.insertMany(
    message.mentions.map((recipient) => ({
      recipient,
      type: "mention" as const,
      room: roomNumber,
      roomName: room?.room_name ?? undefined,
      messageId: message._id!,
      sentBy: message.sentBy,
      preview: message.message.slice(0, PREVIEW_LENGTH),
    })),
  );
  return docs.map((d) => ({
    ...toNotification(d.toObject() as NotificationRecord),
    recipient: d.recipient,
  }));
}

export async function listNotifications(username: string): Promise<NotificationList> {
  const [docs, unreadCount] = await Promise.all([
    NotificationModel.find({ recipient: username })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .lean<NotificationRecord[]>(),
    NotificationModel.countDocuments({ recipient: username, read: false }),
  ]);
  return { notifications: docs.map(toNotification), unreadCount };
}

/** Marks the given notifications (or all of them) read. Only touches the user's own. */
export async function markRead(username: string, ids?: string[]): Promise<void> {
  await NotificationModel.updateMany(
    { recipient: username, read: false, ...(ids && { _id: { $in: ids } }) },
    { $set: { read: true } },
  );
}
