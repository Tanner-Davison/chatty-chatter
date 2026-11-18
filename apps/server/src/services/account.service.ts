import { createHash, randomBytes } from "node:crypto";
import type { Env } from "../config/env";
import * as emails from "../lib/emails";
import { badRequest, conflict, notFound } from "../lib/http-error";
import type { Mailer } from "../lib/mailer";
import { EmailTokenModel } from "../models/email-token.model";
import { UserModel, type UserDocument } from "../models/user.model";
import { hashPassword } from "./auth.service";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
type TokenType = "verify_email" | "reset_password";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fresh single-use token; only its hash is stored. */
async function issueToken(
  username: string,
  type: TokenType,
  ttlMs: number,
  email?: string,
): Promise<string> {
  // A new link replaces any older one of the same kind.
  await EmailTokenModel.deleteMany({ username, type });
  const token = randomBytes(32).toString("base64url");
  await EmailTokenModel.create({
    username,
    type,
    email,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/** Uses up a token, or throws if it's wrong, used or expired. */
async function redeemToken(type: TokenType, token: string) {
  const doc = await EmailTokenModel.findOneAndDelete({ type, tokenHash: hash(token) }).lean();
  if (!doc || doc.expiresAt < new Date()) {
    throw badRequest("This link is invalid or has expired. Request a new one.");
  }
  return doc;
}

export async function emailInUse(email: string, exceptUsername?: string): Promise<boolean> {
  return Boolean(
    await UserModel.exists({ email, ...(exceptUsername && { username: { $ne: exceptUsername } }) }),
  );
}

/** Emails a verification link for the user's current address. */
export async function sendVerification(
  env: Env,
  mailer: Mailer,
  user: { username: string; email?: string | null },
) {
  if (!user.email) throw badRequest("Add an email first");
  const token = await issueToken(user.username, "verify_email", VERIFY_TTL_MS, user.email);
  const link = `${env.APP_URL}/verify-email?token=${token}`;
  await mailer.send({
    to: user.email,
    ...emails.verifyEmail(user.username, link),
    idempotencyKey: `verify-${hash(token).slice(0, 32)}`,
  });
}

/** Sets (or changes) the user's email; it stays unverified until they click the link. */
export async function setEmail(
  env: Env,
  mailer: Mailer,
  username: string,
  email: string,
): Promise<UserDocument> {
  if (await emailInUse(email, username))
    throw conflict("That email is already used by another account");
  const user = await UserModel.findOneAndUpdate(
    { username },
    { $set: { email, emailVerified: false } },
    { returnDocument: "after" },
  );
  if (!user) throw notFound("User not found");
  await sendVerification(env, mailer, user);
  return user;
}

export async function verifyEmail(token: string): Promise<void> {
  const doc = await redeemToken("verify_email", token);
  // Only verify if the address hasn't changed since the link was sent.
  const result = await UserModel.updateOne(
    { username: doc.username, email: doc.email },
    { $set: { emailVerified: true } },
  );
  if (result.matchedCount === 0)
    throw badRequest("This link is for an email that's no longer on the account");
}

/**
 * Emails a reset link if a verified account uses this email. Says nothing
 * either way, so the form can't be used to find out who has an account.
 */
export async function requestPasswordReset(env: Env, mailer: Mailer, email: string): Promise<void> {
  const user = await UserModel.findOne(
    { email, emailVerified: true },
    { username: 1, email: 1 },
  ).lean();
  if (!user?.email) return;
  const token = await issueToken(user.username, "reset_password", RESET_TTL_MS);
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  await mailer.send({
    to: user.email,
    ...emails.resetPassword(user.username, link),
    idempotencyKey: `reset-${hash(token).slice(0, 32)}`,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const doc = await redeemToken("reset_password", token);
  await UserModel.updateOne(
    { username: doc.username },
    { $set: { password: await hashPassword(password) } },
  );
  // Any other outstanding reset links stop working too.
  await EmailTokenModel.deleteMany({ username: doc.username, type: "reset_password" });
}
