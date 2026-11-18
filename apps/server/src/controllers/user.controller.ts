import type { RequestHandler } from "express";
import { updateProfileSchema, usernameParamsSchema } from "@chatty/shared";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as userService from "../services/user.service";

export const getProfile: RequestHandler = async (req, res) => {
  const { username } = parse(usernameParamsSchema, req.params);
  res.json(await userService.getUser(username));
};

export const updateMyProfile: RequestHandler = async (req, res) => {
  const changes = parse(updateProfileSchema, req.body);
  res.json(await userService.updateProfile(currentUser(req).username, changes));
};

export const getFriendship: RequestHandler = async (req, res) => {
  const { username: friend } = parse(usernameParamsSchema, req.params);
  res.json({ isFriend: await userService.isFriend(currentUser(req).username, friend) });
};

export const addFriend: RequestHandler = async (req, res) => {
  const { username: friend } = parse(usernameParamsSchema, req.params);
  await userService.addFriend(currentUser(req).username, friend);
  res.json({ isFriend: true });
};

export const removeFriend: RequestHandler = async (req, res) => {
  const { username: friend } = parse(usernameParamsSchema, req.params);
  await userService.removeFriend(currentUser(req).username, friend);
  res.json({ isFriend: false });
};
