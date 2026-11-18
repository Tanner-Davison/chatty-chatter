import { randomBytes } from "node:crypto";
import type { RoomInvite, RoomSummary } from "@chatty/shared";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import type { Notifier } from "../lib/notifier";
import { RoomModel } from "../models/room.model";
import { UserModel } from "../models/user.model";
import { createNotification } from "./notification.service";
import { addMembership, canAccess, findRoomRecord, hasJoined, toSummary } from "./room.service";

/** 128 random bits; unguessable, so the link alone is enough to get in. */
const newInviteCode = () => randomBytes(16).toString("base64url");

/** Private hubs only, and only for people already inside. */
async function findPrivateRoomFor(username: string, roomNumber: number) {
  const room = await findRoomRecord(roomNumber);
  if (!room.private_room) throw badRequest("Public hubs are open to everyone already");
  if (!(await canAccess(username, room))) throw forbidden("This room is private");
  return room;
}

/** The hub's invite code, made the first time anyone asks for it. Any member may share it. */
export async function getInvite(username: string, roomNumber: number): Promise<RoomInvite> {
  const room = await findPrivateRoomFor(username, roomNumber);
  const readCode = async () =>
    (await RoomModel.findById(room._id).select("-messageHistory +invite_code").lean())?.invite_code;

  const existing = await readCode();
  if (existing) return { code: existing };
  // Only set if still missing, so two members asking at once share one code.
  await RoomModel.updateOne(
    { _id: room._id, invite_code: { $exists: false } },
    { $set: { invite_code: newInviteCode() } },
  );
  return { code: (await readCode())! };
}

/** Replaces the invite code so old links stop working. Only the hub's creator may. */
export async function resetInvite(username: string, roomNumber: number): Promise<RoomInvite> {
  const room = await findPrivateRoomFor(username, roomNumber);
  if (room.created_by !== username) throw forbidden("Only the hub's creator can reset its link");
  const code = newInviteCode();
  await RoomModel.updateOne({ _id: room._id }, { $set: { invite_code: code } });
  return { code };
}

/** Joins the hub an invite link points at, no password needed. */
export async function acceptInvite(username: string, code: string): Promise<RoomSummary> {
  const room = await RoomModel.findOne({ invite_code: code }).select("-messageHistory").lean();
  if (!room) throw notFound("This invite link has expired or doesn't exist");
  if (room.created_by !== username) await addMembership(username, room);
  return toSummary(room);
}

/** A member adds someone to a private hub; they get a notification and the hub in their list. */
export async function addMember(
  by: string,
  roomNumber: number,
  username: string,
  notifier: Notifier,
): Promise<void> {
  const room = await findPrivateRoomFor(by, roomNumber);
  if (!(await UserModel.exists({ username })))
    throw notFound(`There's no user called @${username}`);
  if (room.created_by === username || (await hasJoined(username, roomNumber))) {
    throw conflict(`@${username} is already in this hub`);
  }

  await Promise.all([
    addMembership(username, room),
    RoomModel.updateOne({ _id: room._id }, { $addToSet: { users_in_room: username } }),
  ]);
  const notification = await createNotification({
    recipient: username,
    type: "room_added",
    sentBy: by,
    room: roomNumber,
    roomName: room.room_name ?? undefined,
  });
  notifier.send(username, notification);
}
