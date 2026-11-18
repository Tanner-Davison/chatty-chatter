import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RoomPreferencesInput, User } from "@chatty/shared";
import { api } from "../../lib/api";
import { meQueryKey } from "../auth/api";
import { useCurrentUser } from "../auth/currentUser";
import { DEFAULT_RECEIVED, DEFAULT_SENT, RECEIVED_BUBBLES, SENT_BUBBLES } from "./bubbleColors";

/** The user's chosen bubble colours for one hub (defaults if unset). */
export function useRoomColors(roomNumber: number) {
  const prefs = useCurrentUser().roomPreferences?.[String(roomNumber)];
  const sent = prefs?.sentColor ?? DEFAULT_SENT;
  const received = prefs?.receivedColor ?? DEFAULT_RECEIVED;
  return {
    sent,
    received,
    sentClass: SENT_BUBBLES[sent].bubble,
    sentMentionClass: SENT_BUBBLES[sent].mention,
    receivedClass: RECEIVED_BUBBLES[received].bubble,
  };
}

/** Saves colour choices for a hub; the account updates immediately. */
export function useSetRoomColors(roomNumber: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: RoomPreferencesInput) =>
      api.patch<User>(`/users/me/rooms/${roomNumber}/preferences`, changes),
    onMutate: (changes) => {
      // Show the new colour right away; the server response confirms it.
      queryClient.setQueryData<User | null>(meQueryKey, (me) => {
        if (!me) return me;
        const current = { ...me.roomPreferences?.[String(roomNumber)] };
        for (const [k, v] of Object.entries(changes)) {
          if (v === null) delete current[k as keyof typeof current];
          else if (v) Object.assign(current, { [k]: v });
        }
        return { ...me, roomPreferences: { ...me.roomPreferences, [String(roomNumber)]: current } };
      });
    },
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
    onError: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  });
}
