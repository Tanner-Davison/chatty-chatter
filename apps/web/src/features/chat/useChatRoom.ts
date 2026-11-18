import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ChatMessage } from "@chatty/shared";
import { chatReducer } from "./chatReducer";
import { useSocket } from "./socketContext";

const TYPING_SHOWN_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

/**
 * Live state for one open room: joins it over the socket (again after every
 * reconnect), merges incoming messages and typing events, and sends messages
 * optimistically.
 */
export function useChatRoom(
  room: number,
  history: ChatMessage[],
  username: string,
  onReconnect: () => void,
) {
  const { socket, connected } = useSocket();
  const [messages, dispatch] = useReducer(chatReducer, []);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const lastTypingSent = useRef(0);
  const wasConnected = useRef(connected);

  useEffect(() => dispatch({ type: "loaded", messages: history }), [history]);

  // Join on connect; after a reconnect, also reload history to catch missed messages.
  useEffect(() => {
    if (!connected) return;
    socket.emit("join_room", { room }, (res) => setJoinError(res.ok ? null : res.error));
    if (!wasConnected.current) onReconnect();
    wasConnected.current = true;
    return () => {
      socket.emit("leave_room", { room });
    };
  }, [socket, connected, room, onReconnect]);

  useEffect(() => {
    if (!connected) wasConnected.current = false;
  }, [connected]);

  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const onMessage = (payload: { room: number; message: ChatMessage }) => {
      if (payload.room !== room) return;
      dispatch({ type: "received", message: payload.message });
      setTypingUser(null);
    };
    const onTyping = (payload: { room: number; username: string }) => {
      if (payload.room !== room) return;
      setTypingUser(payload.username);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setTypingUser(null), TYPING_SHOWN_MS);
    };
    const onUpdated = (payload: {
      room: number;
      messageId: string;
      linkPreviewHidden: boolean;
    }) => {
      if (payload.room === room && payload.linkPreviewHidden) {
        dispatch({ type: "previewHidden", messageId: payload.messageId });
      }
    };
    socket.on("receive_message", onMessage);
    socket.on("sender_is_typing", onTyping);
    socket.on("message_updated", onUpdated);
    return () => {
      clearTimeout(typingTimer);
      socket.off("receive_message", onMessage);
      socket.off("sender_is_typing", onTyping);
      socket.off("message_updated", onUpdated);
    };
  }, [socket, room]);

  const send = useCallback(
    (text: string) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      dispatch({ type: "sending", tempId, sentBy: username, text });
      socket.timeout(10_000).emit("send_message", { room, message: text }, (err, res) => {
        if (err || !res.ok) dispatch({ type: "failed", tempId });
        else dispatch({ type: "sent", tempId, message: res.data });
      });
    },
    [socket, room, username],
  );

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    socket.emit("typing", { room });
  }, [socket, room]);

  /** Removes the preview from the sender's own message for everyone. */
  const hidePreview = useCallback(
    (messageId: string) => {
      dispatch({ type: "previewHidden", messageId });
      socket.emit("hide_link_preview", { room, messageId }, () => {});
    },
    [socket, room],
  );

  return { messages, send, notifyTyping, hidePreview, typingUser, connected, joinError };
}
