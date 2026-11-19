import { useState, type FormEvent } from "react";
import { Link2, Lock } from "lucide-react";
import type { RoomSummary } from "@chatty/shared";
import { Button, Field, Panel, PasswordInput } from "../../components/ui";
import { useJoinRoom } from "../rooms/api";

/** Shown instead of the messages for a private hub the user hasn't unlocked. */
export function PrivateRoomGate({ room }: { room: RoomSummary }) {
  const [password, setPassword] = useState("");
  const join = useJoinRoom();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password) join.mutate({ roomNumber: room.room_number, password });
  };

  if (room.invite_only) {
    return (
      <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-5 p-8 text-center shadow-glow-private">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-private-soft text-private ring-1 ring-private/40">
          <Link2 className="size-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold">Invite only</h1>
          <p className="mt-1 text-sm text-fg-muted">
            You need an invite to join this hub. Ask a member to send you its link or add you by
            username.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-5 p-8 text-center shadow-glow-private">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-private-soft text-private ring-1 ring-private/40">
        <Lock className="size-6" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-semibold capitalize">
          {room.room_name?.trim() || "Untitled hub"}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          This hub is private. Enter its password to join.
        </p>
      </div>
      <form onSubmit={submit} className="flex w-full flex-col gap-3 text-left">
        <Field label="Hub password" error={join.error?.message}>
          {(props) => (
            <PasswordInput
              {...props}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="off"
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="private"
          size="lg"
          loading={join.isPending}
          disabled={!password}
        >
          Unlock hub
        </Button>
      </form>
    </Panel>
  );
}
