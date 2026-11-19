import { useState } from "react";
import { useNavigate } from "react-router";
import { MessagesSquare, Plus } from "lucide-react";
import type { RoomSummary } from "@chatty/shared";
import { Button, ConfirmDialog, LoadingBlock } from "../../components/ui";
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

  const [deleting, setDeleting] = useState<RoomSummary | null>(null);
  const onDelete = (room: RoomSummary) => setDeleting(room);

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
            onClick={() => void navigate("/createroom")}
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

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.room_name ?? deleting?.room_number}"?`}
        confirmLabel="Delete hub"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && remove.mutate(deleting.room_number, { onSettled: () => setDeleting(null) })
        }
      >
        The hub and all its messages are removed for everyone. You can't undo this.
      </ConfirmDialog>
    </div>
  );
}
