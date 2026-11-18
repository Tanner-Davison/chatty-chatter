import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification, NotificationList } from "@chatty/shared";
import { api } from "../../lib/api";
import { useSocket } from "../chat/socketContext";

export const notificationsKey = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => api.get<NotificationList>("/notifications"),
    staleTime: 60_000,
  });
}

/** Adds notifications pushed over the socket to the cached list as they arrive. */
export function useLiveNotifications() {
  const { socket, connected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onNotification = (n: Notification) => {
      queryClient.setQueryData<NotificationList>(notificationsKey, (prev) => ({
        notifications: [n, ...(prev?.notifications ?? []).filter((x) => x._id !== n._id)],
        unreadCount: (prev?.unreadCount ?? 0) + 1,
      }));
    };
    const onChanged = () => void queryClient.invalidateQueries({ queryKey: notificationsKey });
    socket.on("notification", onNotification);
    socket.on("notifications_changed", onChanged);
    return () => {
      socket.off("notification", onNotification);
      socket.off("notifications_changed", onChanged);
    };
  }, [socket, queryClient]);

  // Catch up on anything sent while disconnected.
  useEffect(() => {
    if (connected) void queryClient.invalidateQueries({ queryKey: notificationsKey });
  }, [connected, queryClient]);
}

/** Marks some (or, with no ids, all) notifications read, updating the badge immediately. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.post<void>("/notifications/read", ids ? { ids } : {}),
    onMutate: (ids) => {
      queryClient.setQueryData<NotificationList>(notificationsKey, (prev) => {
        if (!prev) return prev;
        const marked = new Set(ids ?? prev.notifications.map((n) => n._id));
        const notifications = prev.notifications.map((n) =>
          marked.has(n._id) ? { ...n, read: true } : n,
        );
        const newlyRead = prev.notifications.filter((n) => !n.read && marked.has(n._id)).length;
        return { notifications, unreadCount: ids ? Math.max(0, prev.unreadCount - newlyRead) : 0 };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}
