import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@chatty/shared";
import { api } from "./api";
import { SOCKET_URL } from "./config";

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Creates the app's single Socket.IO connection. `auth` is a function so every
 * connect and reconnect fetches a fresh one-minute token through the API.
 */
export function createChatSocket(): ChatSocket {
  return io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    auth: (cb) => {
      api
        .get<{ token: string }>("/auth/socket-token")
        .then(({ token }) => cb({ token }))
        .catch(() => cb({ token: "" }));
    },
  });
}
