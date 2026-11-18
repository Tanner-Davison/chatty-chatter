import { useQuery } from "@tanstack/react-query";
import type { DiscoverQuery, DiscoverRoom, RoomPeek } from "@chatty/shared";
import { api } from "../../lib/api";
import { roomKeys } from "../rooms/api";

// Online counts change, so explore data refreshes while the page is open.
const LIVE_REFRESH_MS = 30_000;

export function useDiscover(query: DiscoverQuery) {
  const params = new URLSearchParams();
  if (query.sort) params.set("sort", query.sort);
  if (query.category) params.set("category", query.category);
  if (query.q) params.set("q", query.q);
  const key = params.toString();
  return useQuery({
    queryKey: roomKeys.discover(key),
    queryFn: () => api.get<DiscoverRoom[]>(`/rooms/discover?${key}`),
    refetchInterval: LIVE_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

export function useFriendRooms() {
  return useQuery({
    queryKey: roomKeys.friends,
    queryFn: () => api.get<DiscoverRoom[]>("/rooms/discover/friends"),
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export function useRoomPeek(roomNumber: number | null) {
  return useQuery({
    queryKey: roomKeys.peek(roomNumber ?? 0),
    queryFn: () => api.get<RoomPeek>(`/rooms/${roomNumber}/peek`),
    enabled: roomNumber !== null,
  });
}
