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
/**
 * Finds an account by username (exact, then lowercase: some old accounts
 * aren't lowercase) or, failing that, by email. Usernames win, because some
 * old usernames are themselves email addresses.
 */
export async function findUserWithPassword(identifier: string): Promise<UserDocument | null> {
  const lower = identifier.toLowerCase();
  return (
    (await UserModel.findOne({ username: identifier }).select("+password")) ??
    (identifier !== lower
      ? await UserModel.findOne({ username: lower }).select("+password")
      : null) ??
    (identifier.includes("@")
      ? await UserModel.findOne({ email: lower }).select("+password")
      : null)
  );
}

export async function login({ username, password }: LoginInput): Promise<UserDocument> {
  const user = await findUserWithPassword(username);
  const matches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !matches) throw unauthorized("Wrong username or password");
  return user;
}

export async function signup(
  { username, email, password }: SignupInput,
  profilePic?: ProfilePic,
): Promise<UserDocument> {
  if (await UserModel.exists({ username })) throw conflict("That username is taken");
  if (await UserModel.exists({ email }))
    throw conflict("That email is already used by another account");
  return UserModel.create({
    username,
    email,
    emailVerified: false,
    password: await hashPassword(password),
    ...(profilePic && { profilePic }),
  });
}
