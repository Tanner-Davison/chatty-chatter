import { createContext, use } from "react";
import type { User } from "@chatty/shared";

// Provided by RequireAuth. Reading the user from context rather than the
// query cache means pages never see it vanish mid-render: on logout,
// RequireAuth stops rendering them in the same pass that clears the user.
export const CurrentUserContext = createContext<User | null>(null);

/** The logged-in user. Only for components rendered behind RequireAuth. */
export function useCurrentUser(): User {
  const user = use(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser used outside RequireAuth");
  return user;
}
