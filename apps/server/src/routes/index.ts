import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Env } from "../config/env";
import {
  chatImageUpload,
  imageUpload,
  type ChatImageStore,
  type ImageUploader,
} from "../lib/cloudinary";
import type { GifSearch } from "../lib/gifs";
import { badRequest } from "../lib/http-error";
import type { LinkPreviewer } from "../lib/link-preview";
import type { Mailer } from "../lib/mailer";
import type { Notifier } from "../lib/notifier";
import type { Presence } from "../lib/presence";
import type { Pusher } from "../lib/push";
import { createAlertController } from "../controllers/alert.controller";
import { createAuthController } from "../controllers/auth.controller";
import { createDiscoverController } from "../controllers/discover.controller";
import { createLinkPreviewController } from "../controllers/link-preview.controller";
import { createFriendController } from "../controllers/friend.controller";
import { createGifController } from "../controllers/gif.controller";
import { createInviteController } from "../controllers/invite.controller";
import * as notifications from "../controllers/notification.controller";
import * as rooms from "../controllers/room.controller";
import * as users from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";

export interface ApiDeps {
  uploadImage: ImageUploader;
  presence: Presence;
  chatImages: ChatImageStore;
  notifier: Notifier;
  mailer: Mailer;
  linkPreviewer: LinkPreviewer;
  gifSearch: GifSearch;
  pusher: Pusher;
}

export function createApiRouter(
  env: Env,
  {
    uploadImage,
    presence,
    linkPreviewer,
    chatImages,
    notifier,
    mailer,
    pusher,
    gifSearch,
  }: ApiDeps,
): Router {
  const auth = createAuthController(env, uploadImage, mailer);
  const discover = createDiscoverController(presence);
  const friends = createFriendController(notifier);
  const invites = createInviteController(notifier);
  const alerts = createAlertController(env, pusher);
  const authed = requireAuth(env);
  const router = Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in a few minutes." },
  });

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.post("/auth/signup", authLimiter, imageUpload.single("image"), auth.signup);
  router.post("/auth/login", authLimiter, auth.login);
  router.post("/auth/logout", auth.logout);
  router.post("/auth/verify-email", authLimiter, auth.verifyEmail);
  router.post("/auth/resend-verification", authed, authLimiter, auth.resendVerification);
  router.post("/auth/forgot-password", authLimiter, auth.forgotPassword);
  router.post("/auth/reset-password", authLimiter, auth.resetPassword);
  router.put("/users/me/email", authed, authLimiter, auth.updateEmail);
  router.get("/auth/me", authed, auth.me);
  router.get("/auth/socket-token", authed, auth.socketToken);

  router.get("/users/:username", authed, users.getProfile);
  router.patch("/users/me", authed, users.updateMyProfile);
  router.patch("/users/me/rooms/:roomNumber/preferences", authed, users.setRoomPreferences);
  router.get("/users/me/friends/:username", authed, friends.status);
  router.post("/users/me/friends/:username", authed, friends.request);
  router.delete("/users/me/friends/:username", authed, friends.remove);
  router.post("/friend-requests/:id/accept", authed, friends.accept);
  router.post("/friend-requests/:id/decline", authed, friends.decline);
  router.delete("/friend-requests/:id", authed, friends.cancel);

  router.get("/rooms/mine", authed, rooms.getMyRooms);
  router.get("/rooms/discover", authed, discover.discover);
  router.get("/rooms/discover/friends", authed, discover.friends);
  router.get("/rooms/discover/surprise", authed, discover.surprise);
  router.get("/rooms/search", authed, rooms.searchRooms);
  router.get("/rooms/:roomNumber/availability", authed, rooms.checkAvailability);
  router.get("/rooms/:roomNumber/summary", authed, rooms.getRoomSummary);
  router.get("/rooms/:roomNumber/peek", authed, discover.peek);
  router.get("/rooms/:roomNumber", authed, rooms.getRoom);
  router.post("/rooms", authed, rooms.createRoom);
  router.put("/rooms/:roomNumber/membership", authed, rooms.joinRoom);
  router.delete("/rooms/:roomNumber/membership", authed, rooms.leaveRoom);
  router.delete("/rooms/:roomNumber", authed, rooms.deleteRoom);
  router.get("/rooms/:roomNumber/invite", authed, invites.getInvite);
  router.post("/rooms/:roomNumber/invite/reset", authed, invites.resetInvite);
  router.post("/rooms/:roomNumber/members", authed, invites.addMember);
  router.post("/invites/:code", authed, authLimiter, invites.acceptInvite);

  router.get("/notifications", authed, notifications.listNotifications);
  router.post("/notifications/read", authed, notifications.markRead);
  router.delete("/notifications", authed, notifications.clearNotifications);
  router.delete("/notifications/:id", authed, notifications.deleteNotification);
  router.put("/users/me/alerts", authed, alerts.updateSettings);
  router.get("/push/config", alerts.pushConfig);
  router.post("/push/subscriptions", authed, alerts.subscribe);
  router.delete("/push/subscriptions", authed, alerts.unsubscribePush);
  router.post(
    "/alerts/unsubscribe",
    authLimiter,
    express.urlencoded({ extended: false, limit: "1kb" }),
    alerts.unsubscribeEmail,
  );

  const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many previews. Slow down a little." },
  });
  router.get("/link-preview", authed, previewLimiter, createLinkPreviewController(linkPreviewer));

  const gifLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many GIF searches. Slow down a little." },
  });
  router.get("/gifs", authed, gifLimiter, createGifController(gifSearch));

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: env.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many uploads. Slow down a little." },
  });
  router.post(
    "/uploads/images",
    authed,
    uploadLimiter,
    chatImageUpload.single("image"),
    async (req, res) => {
      if (!req.file) throw badRequest("Attach an image");
      res.status(201).json(await chatImages.upload(req.file));
    },
  );

  return router;
}
