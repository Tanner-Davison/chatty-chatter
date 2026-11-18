import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Friendship, UpdateProfileInput, User } from "@chatty/shared";
import { api } from "../../lib/api";
import { meQueryKey } from "../auth/api";
import { notificationKeys } from "../notifications/api";

export const userKeys = {
  profile: (username: string) => ["users", username] as const,
  friendship: (username: string) => ["users", username, "friendship"] as const,
};

/** Any user's public profile. Cached for a while since avatars appear all over the app. */
export function useUserProfile(username: string | undefined) {
  return useQuery({
    queryKey: userKeys.profile(username ?? ""),
    queryFn: () => api.get<User>(`/users/${encodeURIComponent(username!)}`),
    enabled: Boolean(username),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateProfileInput) => api.patch<User>("/users/me", changes),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      queryClient.setQueryData(userKeys.profile(user.username), user);
    },
  });
}

export function useFriendship(username: string, enabled: boolean) {
  return useQuery({
    queryKey: userKeys.friendship(username),
    queryFn: () => api.get<Friendship>(`/users/me/friends/${encodeURIComponent(username)}`),
    enabled,
  });
}

export type FriendAction =
  | { kind: "request" | "remove"; username: string }
  | { kind: "accept" | "decline" | "cancel"; username: string; requestId: string };

/**
 * Every friend change: send/cancel a request, accept/decline one, or remove a
 * friend. Refreshes the friendship, both profiles and notifications.
 */
export function useFriendAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: FriendAction) => {
      const user = `/users/me/friends/${encodeURIComponent(action.username)}`;
      switch (action.kind) {
        case "request":
          return api.post<Friendship>(user);
        case "remove":
          return api.delete<Friendship>(user);
        case "accept":
        case "decline":
          return api.post<Friendship>(`/friend-requests/${action.requestId}/${action.kind}`);
        case "cancel":
          return api.delete<Friendship>(`/friend-requests/${action.requestId}`);
      }
    },
    onSuccess: (friendship, action) => {
      queryClient.setQueryData(userKeys.friendship(action.username), friendship);
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
      void queryClient.invalidateQueries({ queryKey: userKeys.profile(action.username) });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
