import type { RequestHandler } from "express";
import { discoverQuerySchema, roomNumberParamsSchema } from "@chatty/shared";
import type { Presence } from "../lib/presence";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as discoverService from "../services/discover.service";

export function createDiscoverController(presence: Presence) {
  const discover: RequestHandler = async (req, res) => {
    const query = parse(discoverQuerySchema, req.query);
    res.json(await discoverService.discoverRooms(currentUser(req).username, query, presence));
  };

  const friends: RequestHandler = async (req, res) => {
    res.json(await discoverService.friendRooms(currentUser(req).username, presence));
  };

  const peek: RequestHandler = async (req, res) => {
    const { roomNumber } = parse(roomNumberParamsSchema, req.params);
    res.json(await discoverService.peekRoom(currentUser(req).username, roomNumber, presence));
  };

  return { discover, friends, peek };
}
