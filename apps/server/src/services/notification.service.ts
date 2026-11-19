import { messagePreview } from "@chatty/shared";
import type { Types } from "mongoose";
import type { ChatMessage, Notification, NotificationList } from "@chatty/shared";
import { NotificationModel, type NotificationFields } from "../models/notification.model";
import { RoomModel } from "../models/room.model";
import { UserModel } from "../models/user.model";

const LIST_LIMIT = 30;
const PREVIEW_LENGTH = 140;

type NotificationRecord = NotificationFields & { _id: Types.ObjectId; createdAt: Date };

export function toNotification(n: NotificationRecord): Notification {
  const base = {
    _id: n._id.toString(),
    sentBy: n.sentBy,
    read: n.read ?? false,
    createdAt: n.createdAt.toISOString(),
  };
  switch (n.type) {
    case "friend_request":
      return {
        ...base,
        type: "friend_request",
        requestId: n.requestId ?? "",
        requestStatus: n.requestStatus ?? "pending",
      };
    case "friend_accepted":
      return { ...base, type: "friend_accepted" };
    case "room_added":
      return { ...base, type: "room_added", room: n.room ?? 0, roomName: n.roomName ?? undefined };
    default:
      return {
        ...base,
        type: "mention",
        room: n.room ?? 0,
        roomName: n.roomName ?? undefined,
        messageId: n.messageId ?? "",
        preview: n.preview ?? "",
      };
  }
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
      preview: messagePreview(
        message.message,
        Boolean(message.attachments?.length),
        Boolean(message.gif),
      ).slice(0, PREVIEW_LENGTH),
    })),
  );
  return docs.map((d) => ({
    ...toNotification(d.toObject() as NotificationRecord),
    recipient: d.recipient,
  }));
}

export async function listNotifications(
  username: string,
  limit = LIST_LIMIT,
): Promise<NotificationList> {
  const [docs, unreadCount, total] = await Promise.all([
    NotificationModel.find({ recipient: username })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<NotificationRecord[]>(),
    NotificationModel.countDocuments({ recipient: username, read: false }),
    NotificationModel.countDocuments({ recipient: username }),
  ]);
  return { notifications: docs.map(toNotification), unreadCount, total };
}

/** Marks the given notifications (or all of them) read. Only touches the user's own. */
export async function markRead(username: string, ids?: string[]): Promise<void> {
  await NotificationModel.updateMany(
    { recipient: username, read: false, ...(ids && { _id: { $in: ids } }) },
    { $set: { read: true } },
  );
}

/** Removes the notifications a deleted message created; returns who had them. */
export async function removeForMessage(messageId: string): Promise<string[]> {
  const recipients: string[] = await NotificationModel.distinct("recipient", { messageId });
  if (recipients.length > 0) await NotificationModel.deleteMany({ messageId });
  return recipients;
}

/** Deletes one of the user's notifications (or, with no id, all of them). */
export async function deleteNotifications(username: string, id?: string): Promise<void> {
  await NotificationModel.deleteMany({ recipient: username, ...(id && { _id: id }) });
}

export async function createNotification(
  fields: Partial<NotificationFields> & {
    recipient: string;
    type: NotificationFields["type"];
    sentBy: string;
  },
): Promise<Notification> {
  const doc = await NotificationModel.create(fields);
  return toNotification(doc.toObject() as NotificationRecord);
}
