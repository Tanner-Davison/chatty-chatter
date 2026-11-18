import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, SignupInput, User } from "@chatty/shared";
import { api, isStatus } from "../../lib/api";

export const meQueryKey = ["auth", "me"] as const;

/** The logged-in user, or null when there's no session. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return await api.get<User>("/auth/me");
      } catch (err) {
        if (isStatus(err, 401)) return null;
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** For components rendered behind RequireAuth, where the user is known to exist. */
export function useCurrentUser(): User {
  const { data } = useMe();
  if (!data) throw new Error("useCurrentUser used outside RequireAuth");
  return data;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<User>("/auth/login", input),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ image, ...input }: SignupInput & { image?: File | null }) => {
      const form = new FormData();
      form.append("username", input.username);
      form.append("password", input.password);
      if (image) form.append("image", image);
      return api.post<User>("/auth/signup", form);
    },
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}
