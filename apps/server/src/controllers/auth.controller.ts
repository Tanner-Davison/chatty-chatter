import type { RequestHandler } from "express";
import { loginSchema, signupSchema } from "@chatty/shared";
import type { Env } from "../config/env";
import type { ImageUploader } from "../lib/cloudinary";
import { signSessionToken, signSocketToken } from "../lib/tokens";
import { parse } from "../lib/validate";
import { clearSessionCookie, currentUser, setSessionCookie } from "../middleware/auth";
import * as authService from "../services/auth.service";
import * as userService from "../services/user.service";
import type { UserDocument } from "../models/user.model";

export function createAuthController(env: Env, uploadImage: ImageUploader) {
  const startSession = (res: Parameters<RequestHandler>[1], user: UserDocument) => {
    const token = signSessionToken(env.JWT_SECRET, { sub: user.id, username: user.username });
    setSessionCookie(env, res, token);
  };

  const signup: RequestHandler = async (req, res) => {
    const input = parse(signupSchema, req.body);
    const profilePic = req.file ? await uploadImage(req.file) : undefined;
    const user = await authService.signup(input, profilePic);
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

  return { signup, login, logout, me, socketToken };
}
