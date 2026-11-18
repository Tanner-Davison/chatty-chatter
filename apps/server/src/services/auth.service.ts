import bcrypt from "bcryptjs";
import type { LoginInput, ProfilePic, SignupInput } from "@chatty/shared";
import { conflict, unauthorized } from "../lib/http-error";
import { UserModel, type UserDocument } from "../models/user.model";

const BCRYPT_COST = 12;

// Compared against when the user doesn't exist, so a login for an unknown
// username takes as long as one with a wrong password.
const DUMMY_HASH = bcrypt.hashSync("chatty-timing-guard", BCRYPT_COST);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Exact match first, then lowercase: signup always lowercased, but some old accounts may not be. */
export async function findUserWithPassword(username: string): Promise<UserDocument | null> {
  const exact = await UserModel.findOne({ username }).select("+password");
  if (exact || username === username.toLowerCase()) return exact;
  return UserModel.findOne({ username: username.toLowerCase() }).select("+password");
}

export async function login({ username, password }: LoginInput): Promise<UserDocument> {
  const user = await findUserWithPassword(username);
  const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !matches) throw unauthorized("Wrong username or password");
  return user;
}

export async function signup(
  { username, password }: SignupInput,
  profilePic?: ProfilePic,
): Promise<UserDocument> {
  if (await UserModel.exists({ username })) throw conflict("That username is taken");
  return UserModel.create({
    username,
    password: await hashPassword(password),
    ...(profilePic && { profilePic }),
  });
}
