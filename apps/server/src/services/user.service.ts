import type { RoomPreferencesInput, UpdateProfileInput } from "@chatty/shared";
import { badRequest, notFound } from "../lib/http-error";
import { UserModel, type UserDocument } from "../models/user.model";

export async function getUser(username: string): Promise<UserDocument> {
  const user = await UserModel.findOne({ username });
  if (!user) throw notFound("User not found");
  return user;
}

export async function updateProfile(
  username: string,
  changes: UpdateProfileInput,
): Promise<UserDocument> {
  const user = await UserModel.findOneAndUpdate(
    { username },
    { $set: changes },
    { returnDocument: "after", runValidators: true },
  );
  if (!user) throw notFound("User not found");
  return user;
}

export async function isFriend(username: string, friend: string): Promise<boolean> {
  return Boolean(await UserModel.exists({ username, friends: friend }));
}

export async function addFriend(username: string, friend: string): Promise<void> {
  if (username === friend) throw badRequest("You can't add yourself as a friend");
  if (!(await UserModel.exists({ username: friend }))) throw notFound("User not found");
  await UserModel.updateOne({ username }, { $addToSet: { friends: friend } });
}

export async function removeFriend(username: string, friend: string): Promise<void> {
  await UserModel.updateOne({ username }, { $pull: { friends: friend } });
}

/** Sets (or, with null, clears) the user's chat colours for one hub. */
export async function setRoomPreferences(
  username: string,
  roomNumber: number,
  changes: RoomPreferencesInput,
): Promise<UserDocument> {
  const set: Record<string, string> = {};
  const unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const path = `roomPreferences.${roomNumber}.${key}`;
    if (value === null) unset[path] = "";
    else set[path] = value;
  }
  const user = await UserModel.findOneAndUpdate(
    { username },
    {
      ...(Object.keys(set).length && { $set: set }),
      ...(Object.keys(unset).length && { $unset: unset }),
    },
    { returnDocument: "after" },
  );
  if (!user) throw notFound("User not found");
  return user;
}
