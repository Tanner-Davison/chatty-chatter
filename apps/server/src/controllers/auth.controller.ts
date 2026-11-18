import type { RequestHandler } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateEmailSchema,
  verifyEmailSchema,
} from "@chatty/shared";
import type { Env } from "../config/env";
import type { ImageUploader } from "../lib/cloudinary";
import { badRequest } from "../lib/http-error";
import type { Mailer } from "../lib/mailer";
import { signSessionToken, signSocketToken } from "../lib/tokens";
import { parse } from "../lib/validate";
import { clearSessionCookie, currentUser, setSessionCookie } from "../middleware/auth";
import * as accountService from "../services/account.service";
import * as authService from "../services/auth.service";
import * as userService from "../services/user.service";
import type { UserDocument } from "../models/user.model";

export function createAuthController(env: Env, uploadImage: ImageUploader, mailer: Mailer) {
  const startSession = (res: Parameters<RequestHandler>[1], user: UserDocument) => {
    const token = signSessionToken(env.JWT_SECRET, { sub: user.id, username: user.username });
    setSessionCookie(env, res, token);
  };

  const signup: RequestHandler = async (req, res) => {
    const input = parse(signupSchema, req.body);
    const profilePic = req.file ? await uploadImage(req.file) : undefined;
    const user = await authService.signup(input, profilePic);
    // Signup still succeeds if the email can't be sent; they can resend it.
    await accountService.sendVerification(env, mailer, user).catch((err: unknown) => {
      console.error("Couldn't send verification email", err);
    });
    startSession(res, user);
    res.status(201).json(user);
  };

  const login: RequestHandler = async (req, res) => {
    const user = await authService.login(parse(loginSchema, req.body));
    startSession(res, user);
    res.json(user);
  };

  const logout: RequestHandler = (_req, res) => {
    clearSessionCookie(env, res);
    res.status(204).end();
  };

  const me: RequestHandler = async (req, res) => {
    res.json(await userService.getUser(currentUser(req).username));
  };

  /** A one-minute token the client passes to Socket.IO, which can't use the proxied cookie. */
  const socketToken: RequestHandler = (req, res) => {
    res.json({ token: signSocketToken(env.JWT_SECRET, currentUser(req)) });
  };

  const resendVerification: RequestHandler = async (req, res) => {
    const user = await userService.getUser(currentUser(req).username);
    if (user.emailVerified) throw badRequest("Your email is already verified");
    await accountService.sendVerification(env, mailer, user);
    res.status(204).end();
  };

  const verifyEmail: RequestHandler = async (req, res) => {
    await accountService.verifyEmail(parse(verifyEmailSchema, req.body).token);
    res.status(204).end();
  };

  const updateEmail: RequestHandler = async (req, res) => {
    const { email } = parse(updateEmailSchema, req.body);
    res.json(await accountService.setEmail(env, mailer, currentUser(req).username, email));
  };

  const forgotPassword: RequestHandler = async (req, res) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    // Same answer whether or not the account exists.
    await accountService.requestPasswordReset(env, mailer, email).catch((err: unknown) => {
      console.error("Couldn't send password reset email", err);
    });
    res.status(204).end();
  };

  const resetPassword: RequestHandler = async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await accountService.resetPassword(token, password);
    res.status(204).end();
  };

  return {
    signup,
    login,
    logout,
    me,
    socketToken,
    resendVerification,
    verifyEmail,
    updateEmail,
    forgotPassword,
    resetPassword,
  };
}
