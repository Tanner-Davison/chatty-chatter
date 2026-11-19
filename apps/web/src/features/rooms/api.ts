import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateRoomInput,
  HubCover,
  MyRooms,
  Room,
  RoomInvite,
  RoomSummary,
} from "@chatty/shared";
import { api, isStatus } from "../../lib/api";

export const roomKeys = {
  all: ["rooms"] as const,
  mine: ["rooms", "mine"] as const,
  discover: (params: string) => ["rooms", "discover", params] as const,
  friends: ["rooms", "discover", "friends"] as const,
  peek: (room: number) => ["rooms", "peek", room] as const,
  detail: (room: number) => ["rooms", "detail", room] as const,
  summary: (room: number) => ["rooms", "summary", room] as const,
  search: (name: string) => ["rooms", "search", name] as const,
};

/** Your hubs with their activity; kept fresh so new messages show up on the dashboard. */
export function useMyRooms() {
  return useQuery({
    queryKey: roomKeys.mine,
    queryFn: () => api.get<MyRooms>("/rooms/mine"),
    staleTime: 0,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
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

const inviteKey = (room: number) => ["invites", room] as const;

/** A private hub's invite code, fetched when a member opens the invite panel. */
export function useRoomInvite(roomNumber: number, enabled: boolean) {
  return useQuery({
    queryKey: inviteKey(roomNumber),
    queryFn: () => api.get<RoomInvite>(`/rooms/${roomNumber}/invite`),
    enabled,
    staleTime: Infinity,
  });
}

/** Swaps in a new invite code so old links stop working. */
export function useResetInvite(roomNumber: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RoomInvite>(`/rooms/${roomNumber}/invite/reset`),
    onSuccess: (invite) => queryClient.setQueryData(inviteKey(roomNumber), invite),
  });
}

export const useAcceptInvite = () =>
  useRoomMutation((code: string) => api.post<RoomSummary>(`/invites/${encodeURIComponent(code)}`));

export const useAddMember = (roomNumber: number) =>
  useRoomMutation((username: string) =>
    api.post<void>(`/rooms/${roomNumber}/members`, { username }),
  );

/**
 * Changing a hub's cover: the open hub updates straight away from the response,
 * and lists refetch so cards pick it up.
 */
function useCoverMutation<TVars>(roomNumber: number, fn: (vars: TVars) => Promise<RoomSummary>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (room) => {
      setCachedCover(queryClient, roomNumber, room.cover_image);
      void queryClient.invalidateQueries({
        queryKey: roomKeys.all,
        predicate: (q) => q.queryKey[1] !== "detail",
      });
    },
  });
}

/** Puts a cover on the open hub without refetching its messages. */
export function setCachedCover(
  queryClient: ReturnType<typeof useQueryClient>,
  roomNumber: number,
  cover: HubCover | undefined,
) {
  queryClient.setQueryData<RoomAccess>(roomKeys.detail(roomNumber), (old) => {
    if (!old || old.status === "missing") return old;
    const { cover_image: _old, ...rest } = old.room;
    return { ...old, room: { ...rest, ...(cover && { cover_image: cover }) } } as RoomAccess;
  });
}

export const useUploadCover = (roomNumber: number) =>
  useCoverMutation(roomNumber, (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.put<RoomSummary>(`/rooms/${roomNumber}/cover`, form);
  });

export const useMoveCover = (roomNumber: number) =>
  useCoverMutation(roomNumber, (focus: number) =>
    api.patch<RoomSummary>(`/rooms/${roomNumber}/cover`, { focus }),
  );

export const useRemoveCover = (roomNumber: number) =>
  useCoverMutation(roomNumber, () => api.delete<RoomSummary>(`/rooms/${roomNumber}/cover`));

/** The link people open to join a hub. */
export const inviteUrl = (code: string) => `${window.location.origin}/invite/${code}`;
