import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Notification, NotificationList } from "@chatty/shared";
import { api } from "../../lib/api";
import { useSocket } from "../chat/socketContext";
import { roomKeys } from "../rooms/api";

const ALL_LIMIT = 200;

export const notificationKeys = {
  all: ["notifications"] as const,
  recent: ["notifications", "recent"] as const,
  full: ["notifications", "full"] as const,
};

/** The newest notifications, for the header bell. */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.recent,
    queryFn: () => api.get<NotificationList>("/notifications"),
    staleTime: 60_000,
  });
}

/** Everything, for the notifications page. */
export function useAllNotifications() {
  return useQuery({
    queryKey: notificationKeys.full,
    queryFn: () => api.get<NotificationList>(`/notifications?limit=${ALL_LIMIT}`),
  });
}

/** Applies a change to every cached notification list (bell and page alike). */
function updateLists(
  queryClient: QueryClient,
  change: (list: NotificationList) => NotificationList,
) {
  queryClient.setQueriesData<NotificationList>({ queryKey: notificationKeys.all }, (list) =>
    list ? change(list) : list,
  );
}

/** Adds notifications pushed over the socket as they arrive, and refetches when told to. */
export function useLiveNotifications() {
  const { socket, connected } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onNotification = (n: Notification) => {
      updateLists(queryClient, (list) => ({
        notifications: [n, ...list.notifications.filter((x) => x._id !== n._id)],
        unreadCount: list.unreadCount + 1,
        total: list.total + 1,
      }));
      // Someone added you to a hub: show it in your list straight away.
      if (n.type === "room_added") void queryClient.invalidateQueries({ queryKey: roomKeys.mine });
    };
    const onChanged = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    socket.on("notification", onNotification);
    socket.on("notifications_changed", onChanged);
    return () => {
      socket.off("notification", onNotification);
      socket.off("notifications_changed", onChanged);
    };
  }, [socket, queryClient]);

  // Catch up on anything sent while disconnected.
  useEffect(() => {
    if (connected) void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  }, [connected, queryClient]);
}

/** Marks some (or, with no ids, all) notifications read, updating the badge immediately. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.post<void>("/notifications/read", ids ? { ids } : {}),
    onMutate: (ids) =>
      updateLists(queryClient, (list) => {
        const marked = new Set(ids ?? list.notifications.map((n) => n._id));
        const newlyRead = list.notifications.filter((n) => !n.read && marked.has(n._id)).length;
        return {
          ...list,
          notifications: list.notifications.map((n) =>
            marked.has(n._id) ? { ...n, read: true } : n,
          ),
          unreadCount: ids ? Math.max(0, list.unreadCount - newlyRead) : 0,
        };
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** Deletes one notification, or all of them with no id. Disappears immediately. */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => api.delete<void>(id ? `/notifications/${id}` : "/notifications"),
    onMutate: (id) =>
      updateLists(queryClient, (list) => {
        if (!id) return { notifications: [], unreadCount: 0, total: 0 };
        const gone = list.notifications.find((n) => n._id === id);
        return {
          notifications: list.notifications.filter((n) => n._id !== id),
          unreadCount: list.unreadCount - (gone && !gone.read ? 1 : 0),
          total: Math.max(0, list.total - (gone ? 1 : 0)),
        };
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
