import type { RequestHandler } from "express";
import {
  createRoomSchema,
  joinRoomSchema,
  roomNumberParamsSchema,
  searchRoomsQuerySchema,
} from "@chatty/shared";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as roomService from "../services/room.service";

const roomNumberOf = (params: unknown) => parse(roomNumberParamsSchema, params).roomNumber;

export const getMyRooms: RequestHandler = async (req, res) => {
  res.json(await roomService.getMyRooms(currentUser(req).username));
};

export const searchRooms: RequestHandler = async (req, res) => {
  const { name } = parse(searchRoomsQuerySchema, req.query);
  res.json(await roomService.searchRooms(name));
};

export const checkAvailability: RequestHandler = async (req, res) => {
  res.json({ available: await roomService.isRoomNumberAvailable(roomNumberOf(req.params)) });
};

export const getRoomSummary: RequestHandler = async (req, res) => {
  res.json(await roomService.getRoomSummary(currentUser(req).username, roomNumberOf(req.params)));
};

/** The room with its messages; 403 for a private room the user hasn't joined. */
export const getRoom: RequestHandler = async (req, res) => {
  res.json(
    await roomService.getRoomWithHistory(currentUser(req).username, roomNumberOf(req.params)),
  );
};

export const createRoom: RequestHandler = async (req, res) => {
  const room = await roomService.createRoom(
    currentUser(req).username,
    parse(createRoomSchema, req.body),
  );
  res.status(201).json(room);
};

export const joinRoom: RequestHandler = async (req, res) => {
  const { password } = parse(joinRoomSchema, req.body ?? {});
  const room = await roomService.joinRoom(
    currentUser(req).username,
    roomNumberOf(req.params),
    password,
  );
  res.json(room);
};

export const leaveRoom: RequestHandler = async (req, res) => {
  await roomService.leaveRoom(currentUser(req).username, roomNumberOf(req.params));
  res.status(204).end();
};

export const deleteRoom: RequestHandler = async (req, res) => {
  await roomService.deleteRoom(currentUser(req).username, roomNumberOf(req.params));
  res.status(204).end();
};
