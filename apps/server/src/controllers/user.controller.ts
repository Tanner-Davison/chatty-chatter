import type { RequestHandler } from "express";
import {
  roomNumberParamsSchema,
  roomPreferencesSchema,
  updateProfileSchema,
  usernameParamsSchema,
} from "@chatty/shared";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as userService from "../services/user.service";

export const getProfile: RequestHandler = async (req, res) => {
  const { username } = parse(usernameParamsSchema, req.params);
  const profile = (await userService.getUser(username)).toJSON() as Record<string, unknown>;
  // Chat colour choices are personal.
  if (username !== currentUser(req).username) delete profile.roomPreferences;
  res.json(profile);
};

export const updateMyProfile: RequestHandler = async (req, res) => {
  const changes = parse(updateProfileSchema, req.body);
  res.json(await userService.updateProfile(currentUser(req).username, changes));
};

export const setRoomPreferences: RequestHandler = async (req, res) => {
  const { roomNumber } = parse(roomNumberParamsSchema, req.params);
  const changes = parse(roomPreferencesSchema, req.body ?? {});
  res.json(await userService.setRoomPreferences(currentUser(req).username, roomNumber, changes));
};
