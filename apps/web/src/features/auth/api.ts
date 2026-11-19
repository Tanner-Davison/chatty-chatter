import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, SignupInput, User } from "@chatty/shared";
import { api, isStatus } from "../../lib/api";
import { turnOffPopups } from "../notifications/alerts";

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
      form.append("email", input.email);
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
    mutationFn: async () => {
      // While still logged in, so the server forgets this device too.
      await turnOffPopups().catch(() => {});
      await api.post<void>("/auth/logout");
    },
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}

/** Confirms an email from the link in the verification email. */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<void>("/auth/verify-email", { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => api.post<void>("/auth/resend-verification") });
}

/** Adds or changes the account's email; a verification link goes to the new address. */
export function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.put<User>("/users/me/email", { email }),
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<void>("/auth/forgot-password", { email }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api.post<void>("/auth/reset-password", input),
  });
}
