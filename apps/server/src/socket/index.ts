import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { z } from "zod";
import {
  hideLinkPreviewSchema,
  roomEventSchema,
  sendMessageSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@chatty/shared";
import { isAllowedOrigin, type Env } from "../config/env";
import { HttpError } from "../lib/http-error";
import type { Presence } from "../lib/presence";
import { verifySocketToken } from "../lib/tokens";
import * as messageService from "../services/message.service";
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

function registerHandlers(io: ChatServer, socket: ChatSocket): void {
  const { username } = socket.data;
  void socket.join(userChannel(username));

  socket.on(
    "join_room",
    handle(roomEventSchema, async ({ room }) => {
      await roomService.assertCanAccess(username, room);
      await socket.join(channel(room));
      await roomService.markPresent(username, room);
      return undefined;
    }),
  );

  socket.on(
    "leave_room",
    handle(roomEventSchema, async ({ room }) => {
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
      const { message, notifications } = await messageService.sendMessage(username, payload);
      socket.to(channel(payload.room)).emit("receive_message", { room: payload.room, message });
      for (const { recipient, ...notification } of notifications) {
        io.to(userChannel(recipient)).emit("notification", notification);
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
    "typing",
    handle(roomEventSchema, async ({ room }) => {
      if (socket.rooms.has(channel(room))) {
        socket.to(channel(room)).emit("sender_is_typing", { room, username });
      }
    }),
  );
}

export function createSocketServer(env: Env, httpServer: HttpServer): ChatServer {
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

  io.on("connection", (socket) => registerHandlers(io, socket));
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
  };
}
