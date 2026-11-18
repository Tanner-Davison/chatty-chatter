import { useNavigate } from "react-router";
import { MessagesSquare, Plus } from "lucide-react";
import type { RoomSummary } from "@chatty/shared";
import { Button, LoadingBlock } from "../../components/ui";
import { useCurrentUser } from "../auth/currentUser";
import { DiscoverTeaser } from "../explore/DiscoverTeaser";
import { useDeleteRoom, useLeaveRoom, useMyRooms } from "./api";
import { RoomGrid } from "./RoomGrid";

/** The community hub everyone lands in. */
const COMMUNITY_ROOM = 1;

export function RoomsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const mine = useMyRooms();
  const leave = useLeaveRoom();
  const remove = useDeleteRoom();

  const created = mine.data?.created ?? [];
  const isNewUser = mine.isSuccess && created.length === 0 && mine.data.joined.length === 0;

  const onDelete = (room: RoomSummary) => {
    if (
      window.confirm(
        `Delete "${room.room_name ?? room.room_number}" and all its messages? This can't be undone.`,
      )
    ) {
      remove.mutate(room.room_number);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col items-center gap-4 py-4 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back, <span className="text-primary">{user.username}</span>
        </h1>
        {isNewUser && (
          <p className="text-fg-muted">Create a hub to unlock the rest of your dashboard.</p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            icon={<MessagesSquare className="size-5" />}
            onClick={() => void navigate(`/chatroom/${COMMUNITY_ROOM}`)}
          >
            Community hub
          </Button>
          <Button
            size="lg"
            icon={<Plus className="size-5" />}
            onClick={() => void navigate("/createroom/0")}
          >
            New hub
          </Button>
        </div>
      </section>

      {mine.isPending ? (
        <LoadingBlock label="Loading your hubs" />
      ) : mine.isError ? (
        <p className="text-center text-danger">Couldn't load your hubs. {mine.error.message}</p>
      ) : (
        <>
          <RoomGrid
            title="Subscribed hubs"
            kind="subscribed"
            rooms={mine.data.joined}
            emptyText="Subscribe to a hub and it shows up here."
            onLeave={(room) => leave.mutate(room.room_number)}
          />
          <RoomGrid
            title="Your public hubs"
            kind="public"
            rooms={created.filter((r) => !r.private_room)}
            emptyText="Create a public hub to see it here."
            onDelete={onDelete}
          />
          <RoomGrid
            title="Your private hubs"
            kind="private"
            rooms={created.filter((r) => r.private_room)}
            emptyText="Private hubs are password protected. Create one to see it here."
            onDelete={onDelete}
          />
        </>
      )}

      <DiscoverTeaser />
    </div>
  );
}
