import type { Friendship, Notification } from "@chatty/shared";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import type { Notifier } from "../lib/notifier";
import { FriendRequestModel } from "../models/friend-request.model";
import { NotificationModel } from "../models/notification.model";
import { UserModel } from "../models/user.model";
import { createNotification } from "./notification.service";

async function areFriends(a: string, b: string): Promise<boolean> {
  return Boolean(await UserModel.exists({ username: a, friends: b }));
}

/** How `viewer` relates to `other`. */
export async function getFriendship(viewer: string, other: string): Promise<Friendship> {
  if (viewer === other) return { status: "self" };
  if (await areFriends(viewer, other)) return { status: "friends" };
  const pending = await FriendRequestModel.findOne({
    status: "pending",
    $or: [
      { from: viewer, to: other },
      { from: other, to: viewer },
    ],
  }).lean();
  if (!pending) return { status: "none" };
  return {
    status: pending.from === viewer ? "request_sent" : "request_received",
    requestId: pending._id.toString(),
  };
}

/** Marks a request's notification with its outcome so the recipient's list shows it. */
async function settleRequestNotification(requestId: string, status: "accepted" | "declined") {
  await NotificationModel.updateMany(
    { requestId },
    { $set: { requestStatus: status, read: true } },
  );
}

async function befriend(a: string, b: string): Promise<void> {
  await Promise.all([
    UserModel.updateOne({ username: a }, { $addToSet: { friends: b } }),
    UserModel.updateOne({ username: b }, { $addToSet: { friends: a } }),
  ]);
}

async function acceptRequest(requestId: string, from: string, to: string, notifier: Notifier) {
  await FriendRequestModel.updateOne({ _id: requestId }, { $set: { status: "accepted" } });
  await befriend(from, to);
  await settleRequestNotification(requestId, "accepted");
  notifier.changed(to);
  const accepted = await createNotification({
    recipient: from,
    type: "friend_accepted",
    sentBy: to,
  });
  notifier.send(from, accepted);
}

/**
 * Sends a friend request. If the other person already asked you, this accepts
 * theirs instead. Sending twice is harmless.
 */
export async function sendRequest(
  from: string,
  to: string,
  notifier: Notifier,
): Promise<Friendship> {
  if (from === to) throw badRequest("You can't add yourself as a friend");
  if (!(await UserModel.exists({ username: to }))) throw notFound("User not found");
  if (await areFriends(from, to)) throw conflict("You're already friends");

  const theirs = await FriendRequestModel.findOne({ from: to, to: from, status: "pending" }).lean();
  if (theirs) {
    await acceptRequest(theirs._id.toString(), to, from, notifier);
    return { status: "friends" };
  }
  const mine = await FriendRequestModel.findOne({ from, to, status: "pending" }).lean();
  if (mine) return { status: "request_sent", requestId: mine._id.toString() };

  const request = await FriendRequestModel.create({ from, to });
  const requestId = request._id.toString();
  const notification: Notification = await createNotification({
    recipient: to,
    type: "friend_request",
    sentBy: from,
    requestId,
    requestStatus: "pending",
  });
  notifier.send(to, notification);
  return { status: "request_sent", requestId };
}

async function findPending(requestId: string) {
  const request = await FriendRequestModel.findById(requestId).lean();
  if (!request) throw notFound("Friend request not found");
  if (request.status !== "pending") throw conflict(`This request was already ${request.status}`);
  return request;
}

/** Only the person who received the request can accept it. */
export async function accept(
  username: string,
  requestId: string,
  notifier: Notifier,
): Promise<Friendship> {
  const request = await findPending(requestId);
  if (request.to !== username) throw forbidden("Only the person asked can accept");
  await acceptRequest(requestId, request.from, request.to, notifier);
  return { status: "friends" };
}

/** Only the person who received the request can decline it. The sender isn't told. */
export async function decline(
  username: string,
  requestId: string,
  notifier: Notifier,
): Promise<Friendship> {
  const request = await findPending(requestId);
  if (request.to !== username) throw forbidden("Only the person asked can decline");
  await FriendRequestModel.updateOne({ _id: requestId }, { $set: { status: "declined" } });
  await settleRequestNotification(requestId, "declined");
  notifier.changed(username);
  return { status: "none" };
}

/** Only the sender can cancel; the request disappears from the other person's notifications. */
export async function cancel(
  username: string,
  requestId: string,
  notifier: Notifier,
): Promise<Friendship> {
  const request = await findPending(requestId);
  if (request.from !== username) throw forbidden("Only the sender can cancel a request");
  await FriendRequestModel.updateOne({ _id: requestId }, { $set: { status: "cancelled" } });
  await NotificationModel.deleteMany({ requestId });
  notifier.changed(request.to);
  return { status: "none" };
}

/** Ends a friendship on both sides. */
export async function removeFriend(username: string, friend: string): Promise<Friendship> {
  await Promise.all([
    UserModel.updateOne({ username }, { $pull: { friends: friend } }),
    UserModel.updateOne({ username: friend }, { $pull: { friends: username } }),
  ]);
  return { status: "none" };
}
