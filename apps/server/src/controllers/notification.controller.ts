import type { RequestHandler } from "express";
import { markNotificationsReadSchema } from "@chatty/shared";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as notificationService from "../services/notification.service";

export const listNotifications: RequestHandler = async (req, res) => {
  res.json(await notificationService.listNotifications(currentUser(req).username));
};

export const markRead: RequestHandler = async (req, res) => {
  const { ids } = parse(markNotificationsReadSchema, req.body ?? {});
  await notificationService.markRead(currentUser(req).username, ids);
  res.status(204).end();
};
