import { useEffect, useState, type ReactNode } from "react";
import { createChatSocket } from "../../lib/socket";
import { SocketContext } from "./socketContext";

/** Owns the app's one Socket.IO connection while the user is logged in. */
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState(createChatSocket);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  return <SocketContext value={{ socket, connected }}>{children}</SocketContext>;
}
