import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Env } from "../config/env";
import { imageUpload, type ImageUploader } from "../lib/cloudinary";
import type { Presence } from "../lib/presence";
import { createAuthController } from "../controllers/auth.controller";
import { createDiscoverController } from "../controllers/discover.controller";
import * as rooms from "../controllers/room.controller";
import * as users from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth";

export function createApiRouter(env: Env, uploadImage: ImageUploader, presence: Presence): Router {
  const auth = createAuthController(env, uploadImage);
  const discover = createDiscoverController(presence);
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
  router.get("/auth/me", authed, auth.me);
  router.get("/auth/socket-token", authed, auth.socketToken);

  router.get("/users/:username", authed, users.getProfile);
  router.patch("/users/me", authed, users.updateMyProfile);
  router.get("/users/me/friends/:username", authed, users.getFriendship);
  router.put("/users/me/friends/:username", authed, users.addFriend);
  router.delete("/users/me/friends/:username", authed, users.removeFriend);

  router.get("/rooms/mine", authed, rooms.getMyRooms);
  router.get("/rooms/discover", authed, discover.discover);
  router.get("/rooms/discover/friends", authed, discover.friends);
  router.get("/rooms/search", authed, rooms.searchRooms);
  router.get("/rooms/:roomNumber/availability", authed, rooms.checkAvailability);
  router.get("/rooms/:roomNumber/summary", authed, rooms.getRoomSummary);
  router.get("/rooms/:roomNumber/peek", authed, discover.peek);
  router.get("/rooms/:roomNumber", authed, rooms.getRoom);
  router.post("/rooms", authed, rooms.createRoom);
  router.put("/rooms/:roomNumber/membership", authed, rooms.joinRoom);
  router.delete("/rooms/:roomNumber/membership", authed, rooms.leaveRoom);
  router.delete("/rooms/:roomNumber", authed, rooms.deleteRoom);

  return router;
}
