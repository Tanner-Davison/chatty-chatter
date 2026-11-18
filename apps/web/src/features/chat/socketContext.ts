import { createContext, use } from "react";
import type { ChatSocket } from "../../lib/socket";

interface SocketState {
  socket: ChatSocket;
  connected: boolean;
}

export const SocketContext = createContext<SocketState | null>(null);

export function useSocket(): SocketState {
  const state = use(SocketContext);
  if (!state) throw new Error("useSocket must be used inside SocketProvider");
  return state;
}
