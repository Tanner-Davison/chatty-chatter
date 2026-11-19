import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { z } from "zod";
import {
  hideLinkPreviewSchema,
  messageRefSchema,
  roomEventSchema,
  sendMessageSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@chatty/shared";
import { isAllowedOrigin, type Env } from "../config/env";
import { isOwnChatImage, unavailableImageStore, type ChatImageStore } from "../lib/cloudinary";
import { HttpError } from "../lib/http-error";
import type { Notifier } from "../lib/notifier";
import type { Presence } from "../lib/presence";
import { verifySocketToken } from "../lib/tokens";
import * as alertService from "../services/alert.service";
import * as messageService from "../services/message.service";
import * as notificationService from "../services/notification.service";
import * as roomService from "../services/room.service";

export type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

// Socket.IO room names are strings; prefixing keeps them apart from socket ids.
const channel = (room: number) => `room:${room}`;
/** Every socket a user has open joins their personal channel, for notifications. */
const userChannel = (username: string) => `user:${username}`;

function errorMessage(err: unknown): string {
  if (err instanceof HttpError) return err.message;
  console.error(err);
  return "Something went wrong";
}

/** Validates a payload and runs the handler, reporting failures through the ack instead of throwing. */
function handle<S extends z.ZodType, T>(schema: S, fn: (payload: z.output<S>) => Promise<T>) {
  return async (raw: unknown, ack?: Ack<T>) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      reply({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" });
      return;
    }
    try {
      reply({ ok: true, data: await fn(parsed.data) });
    } catch (err) {
      reply({ ok: false, error: errorMessage(err) });
    }
  };
}

function registerHandlers(
  io: ChatServer,
  socket: ChatSocket,
  env: Env,
  chatImages: ChatImageStore,
  notifier: Notifier,
): void {
  const { username } = socket.data;
  void socket.join(userChannel(username));
  const markActive = () =>
    void alertService
      .markActive(username)
      .catch((err: unknown) => console.error("Couldn't record activity", err));
  markActive();

  // Closing the tab or losing connection counts as having seen the open hub.
  socket.on("disconnecting", () => {
    markActive();
    for (const name of socket.rooms) {
      if (name.startsWith("room:"))
        void roomService
          .markSeen(username, Number(name.slice(5)))
          // Best effort: the socket is already going away, so just log.
          .catch((err: unknown) => console.error("Couldn't record last seen", err));
    }
  });

  socket.on(
    "join_room",
    handle(roomEventSchema, async ({ room }) => {
      await roomService.assertCanAccess(username, room);
      await socket.join(channel(room));
      await roomService.markPresent(username, room);
      await roomService.markSeen(username, room);
      return undefined;
    }),
  );

  socket.on(
    "leave_room",
    handle(roomEventSchema, async ({ room }) => {
      if (socket.rooms.has(channel(room))) await roomService.markSeen(username, room);
      await socket.leave(channel(room));
    }),
  );

  socket.on(
    "send_message",
    handle(sendMessageSchema, async (payload) => {
      // Joining checked access, so only members of the channel may post.
      if (!socket.rooms.has(channel(payload.room))) {
        throw new HttpError(403, "Join the room before sending messages");
      }
      if (payload.attachments?.some((a) => !isOwnChatImage(env, a))) {
        throw new HttpError(400, "Photos must be uploaded through Chatty Chatter");
      }
      const { message, notifications } = await messageService.sendMessage(username, payload);
      socket.to(channel(payload.room)).emit("receive_message", { room: payload.room, message });
      for (const { recipient, ...notification } of notifications) {
        notifier.send(recipient, notification);
      }
      return message;
    }),
  );

  socket.on(
    "hide_link_preview",
    handle(hideLinkPreviewSchema, async ({ room, messageId }) => {
      await roomService.assertCanAccess(username, room);
      await roomService.hideLinkPreview(username, room, messageId);
      io.to(channel(room)).emit("message_updated", { room, messageId, linkPreviewHidden: true });
      return undefined;
    }),
  );

  socket.on(
    "delete_message",
    handle(messageRefSchema, async ({ room, messageId }) => {
      await roomService.assertCanAccess(username, room);
      const photos = await roomService.deleteMessage(username, room, messageId);
      void chatImages.remove(photos);
      io.to(channel(room)).emit("message_deleted", { room, messageId });
      for (const recipient of await notificationService.removeForMessage(messageId)) {
        notifier.changed(recipient);
      }
      return undefined;
    }),
  );

  socket.on(
    "typing",
    handle(roomEventSchema, async ({ room }) => {
      if (socket.rooms.has(channel(room))) {
        socket.to(channel(room)).emit("sender_is_typing", { room, username });
      }
    }),
  );
}

export function createSocketServer(
  env: Env,
  httpServer: HttpServer,
  chatImages: ChatImageStore = unavailableImageStore,
  /** Defaults to delivering to open tabs only. */
  notifier?: Notifier,
): ChatServer {
  const io: ChatServer = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => cb(null, isAllowedOrigin(env, origin)),
      credentials: true,
    },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const claims = typeof token === "string" ? verifySocketToken(env.JWT_SECRET, token) : null;
    if (!claims) return next(new Error("unauthorized"));
    socket.data.username = claims.username;
    next();
  });

  const deliver = notifier ?? socketNotifier(io);
  io.on("connection", (socket) => registerHandlers(io, socket, env, chatImages, deliver));
  return io;
}

/** Counts distinct users (not tabs) with each room open, from the live socket rooms. */
export function socketPresence(io: ChatServer): Presence {
  return {
    onlineCounts(rooms) {
      const counts = new Map<number, number>();
      for (const room of rooms) {
        const ids = io.sockets.adapter.rooms.get(channel(room));
        if (!ids) continue;
        const users = new Set<string>();
        for (const id of ids) {
          const username = io.sockets.sockets.get(id)?.data.username;
          if (username) users.add(username);
        }
        counts.set(room, users.size);
      }
      return counts;
    },
    isOnline: (username) => (io.sockets.adapter.rooms.get(userChannel(username))?.size ?? 0) > 0,
  };
}

/** Delivers notifications to every tab a user has open. */
export function socketNotifier(io: ChatServer): Notifier {
  return {
    send: (recipient, notification) =>
      io.to(userChannel(recipient)).emit("notification", notification),
    changed: (recipient) => io.to(userChannel(recipient)).emit("notifications_changed"),
  };
}
