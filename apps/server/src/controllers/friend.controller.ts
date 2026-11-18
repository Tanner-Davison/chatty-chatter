import type { RequestHandler } from "express";
import { objectIdSchema, usernameParamsSchema } from "@chatty/shared";
import { z } from "zod";
import type { Notifier } from "../lib/notifier";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as friendService from "../services/friend.service";

const requestParams = z.object({ id: objectIdSchema });

export function createFriendController(notifier: Notifier) {
  const me = (req: Parameters<RequestHandler>[0]) => currentUser(req).username;
  const other = (req: Parameters<RequestHandler>[0]) =>
    parse(usernameParamsSchema, req.params).username;
  const requestId = (req: Parameters<RequestHandler>[0]) => parse(requestParams, req.params).id;

  const status: RequestHandler = async (req, res) => {
    res.json(await friendService.getFriendship(me(req), other(req)));
  };
  const request: RequestHandler = async (req, res) => {
    res.json(await friendService.sendRequest(me(req), other(req), notifier));
  };
  const remove: RequestHandler = async (req, res) => {
    res.json(await friendService.removeFriend(me(req), other(req)));
  };
  const accept: RequestHandler = async (req, res) => {
    res.json(await friendService.accept(me(req), requestId(req), notifier));
  };
  const decline: RequestHandler = async (req, res) => {
    res.json(await friendService.decline(me(req), requestId(req), notifier));
  };
  const cancel: RequestHandler = async (req, res) => {
    res.json(await friendService.cancel(me(req), requestId(req), notifier));
  };

  return { status, request, remove, accept, decline, cancel };
}
