import type { RequestHandler } from "express";
import { markNotificationsReadSchema, objectIdSchema } from "@chatty/shared";
import { z } from "zod";
import { parse } from "../lib/validate";
import { currentUser } from "../middleware/auth";
import * as notificationService from "../services/notification.service";

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).optional() });

export const listNotifications: RequestHandler = async (req, res) => {
  const { limit } = parse(listQuery, req.query);
  res.json(await notificationService.listNotifications(currentUser(req).username, limit));
};

export const deleteNotification: RequestHandler = async (req, res) => {
  const { id } = parse(z.object({ id: objectIdSchema }), req.params);
  await notificationService.deleteNotifications(currentUser(req).username, id);
  res.status(204).end();
};

export const clearNotifications: RequestHandler = async (req, res) => {
  await notificationService.deleteNotifications(currentUser(req).username);
  res.status(204).end();
};

export const markRead: RequestHandler = async (req, res) => {
  const { ids } = parse(markNotificationsReadSchema, req.body ?? {});
  await notificationService.markRead(currentUser(req).username, ids);
  res.status(204).end();
};
