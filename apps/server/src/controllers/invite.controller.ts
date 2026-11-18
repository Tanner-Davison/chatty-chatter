import type { RequestHandler } from "express";
import { addMemberSchema, inviteCodeParamsSchema, roomNumberParamsSchema } from "@chatty/shared";
import type { Notifier } from "../lib/notifier";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as inviteService from "../services/invite.service";

const roomNumberOf = (params: unknown) => parse(roomNumberParamsSchema, params).roomNumber;

export function createInviteController(notifier: Notifier) {
  const getInvite: RequestHandler = async (req, res) => {
    res.json(await inviteService.getInvite(currentUser(req).username, roomNumberOf(req.params)));
  };

  const resetInvite: RequestHandler = async (req, res) => {
    res.json(await inviteService.resetInvite(currentUser(req).username, roomNumberOf(req.params)));
  };

  const acceptInvite: RequestHandler = async (req, res) => {
    const { code } = parse(inviteCodeParamsSchema, req.params);
    res.json(await inviteService.acceptInvite(currentUser(req).username, code));
  };

  const addMember: RequestHandler = async (req, res) => {
    const { username } = parse(addMemberSchema, req.body);
    await inviteService.addMember(
      currentUser(req).username,
      roomNumberOf(req.params),
      username,
      notifier,
    );
    res.status(204).end();
  };

  return { getInvite, resetInvite, acceptInvite, addMember };
}
