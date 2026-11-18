import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRoomInput, MyRooms, Room, RoomSummary } from "@chatty/shared";
import { api, isStatus } from "../../lib/api";

export const roomKeys = {
  all: ["rooms"] as const,
  mine: ["rooms", "mine"] as const,
  explore: ["rooms", "explore"] as const,
  detail: (room: number) => ["rooms", "detail", room] as const,
  summary: (room: number) => ["rooms", "summary", room] as const,
  search: (name: string) => ["rooms", "search", name] as const,
};

export function useMyRooms() {
  return useQuery({ queryKey: roomKeys.mine, queryFn: () => api.get<MyRooms>("/rooms/mine") });
}

export function useExploreRooms() {
  return useQuery({
    queryKey: roomKeys.explore,
    queryFn: () => api.get<RoomSummary[]>("/rooms/explore"),
  });
}

export function useRoomSearch(name: string) {
  return useQuery({
    queryKey: roomKeys.search(name),
    queryFn: () => api.get<RoomSummary[]>(`/rooms/search?name=${encodeURIComponent(name)}`),
    enabled: name.length > 0,
    staleTime: 30_000,
  });
}

export type RoomAccess =
  { status: "open"; room: Room } | { status: "locked"; room: RoomSummary } | { status: "missing" };

/** Loads a room with its messages, or tells the caller it's locked or doesn't exist. */
export function useRoom(roomNumber: number) {
  return useQuery({
    queryKey: roomKeys.detail(roomNumber),
    queryFn: async (): Promise<RoomAccess> => {
      try {
        return { status: "open", room: await api.get<Room>(`/rooms/${roomNumber}`) };
      } catch (err) {
        if (isStatus(err, 404)) return { status: "missing" };
        if (isStatus(err, 403)) {
          return {
            status: "locked",
            room: await api.get<RoomSummary>(`/rooms/${roomNumber}/summary`),
          };
        }
        throw err;
      }
    },
    enabled: Number.isSafeInteger(roomNumber) && roomNumber > 0,
  });
}

export async function isRoomNumberAvailable(roomNumber: number): Promise<boolean> {
  const { available } = await api.get<{ available: boolean }>(`/rooms/${roomNumber}/availability`);
  return available;
}

function useRoomMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomKeys.all }),
  });
}

export const useCreateRoom = () =>
  useRoomMutation((input: CreateRoomInput) => api.post<RoomSummary>("/rooms", input));

export const useJoinRoom = () =>
  useRoomMutation(({ roomNumber, password }: { roomNumber: number; password?: string }) =>
    api.put<RoomSummary>(`/rooms/${roomNumber}/membership`, password ? { password } : {}),
  );

export const useLeaveRoom = () =>
  useRoomMutation((roomNumber: number) => api.delete<void>(`/rooms/${roomNumber}/membership`));

export const useDeleteRoom = () =>
  useRoomMutation((roomNumber: number) => api.delete<void>(`/rooms/${roomNumber}`));
