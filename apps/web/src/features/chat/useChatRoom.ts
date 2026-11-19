import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Attachment, ChatMessage, Gif } from "@chatty/shared";
import { chatReducer, type ChatEntry } from "./chatReducer";
import { roomKeys } from "../rooms/api";
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
  const queryClient = useQueryClient();
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
      // Leaving marks the hub seen on the server; refresh the dashboard's
      // unread counts once that has landed.
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: roomKeys.mine }), 400);
    };
  }, [socket, connected, room, onReconnect, queryClient]);

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
    const onDeleted = (payload: { room: number; messageId: string }) => {
      if (payload.room === room) dispatch({ type: "deleted", key: payload.messageId });
    };
    socket.on("message_updated", onUpdated);
    socket.on("message_deleted", onDeleted);
    return () => {
      clearTimeout(typingTimer);
      socket.off("receive_message", onMessage);
      socket.off("sender_is_typing", onTyping);
      socket.off("message_updated", onUpdated);
      socket.off("message_deleted", onDeleted);
    };
  }, [socket, room]);

  const send = useCallback(
    (text: string, attachments: Attachment[] = [], gif?: Gif) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      dispatch({ type: "sending", tempId, sentBy: username, text, attachments, gif });
      const payload = {
        room,
        message: text,
        ...(attachments.length > 0 && { attachments }),
        ...(gif && { gif }),
      };
      socket.timeout(10_000).emit("send_message", payload, (err, res) => {
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

  /**
   * Deletes your message for everyone. It disappears right away; if the server
   * refuses, history reloads to bring it back. Unsent messages only exist here.
   */
  const deleteMessage = useCallback(
    (message: ChatEntry) => {
      dispatch({ type: "deleted", key: message.key });
      if (message.status !== "sent" || !message._id) return;
      socket.emit("delete_message", { room, messageId: message._id }, (res) => {
        if (!res.ok) onReconnect();
      });
    },
    [socket, room, onReconnect],
  );

  return {
    messages,
    send,
    notifyTyping,
    hidePreview,
    deleteMessage,
    typingUser,
    connected,
    joinError,
  };
}
