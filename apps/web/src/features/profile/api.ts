import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileInput, User } from "@chatty/shared";
import { api } from "../../lib/api";
import { meQueryKey } from "../auth/api";

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
    queryFn: () =>
      api.get<{ isFriend: boolean }>(`/users/me/friends/${encodeURIComponent(username)}`),
    enabled,
  });
}

export function useSetFriend(username: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friend: boolean) => {
      const path = `/users/me/friends/${encodeURIComponent(username)}`;
      return friend
        ? api.put<{ isFriend: boolean }>(path)
        : api.delete<{ isFriend: boolean }>(path);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(userKeys.friendship(username), result);
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}
