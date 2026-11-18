import { useState } from "react";
import { Link } from "react-router";
import { Check, Clock, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Avatar, Button, ConfirmDialog, Panel, PanelHeader } from "../../components/ui";
import { useFriendAction, useFriendship, useUserProfile } from "./api";

/** Add / pending / accept-decline / friends, depending on how you relate to this person. */
export function FriendButton({ username }: { username: string }) {
  const { data } = useFriendship(username, true);
  const act = useFriendAction();
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!data || data.status === "self") return null;

  const busy = act.isPending;
  switch (data.status) {
    case "none":
      return (
        <Button
          variant="primary"
          icon={<UserPlus className="size-4" />}
          loading={busy}
          onClick={() => act.mutate({ kind: "request", username })}
        >
          Add friend
        </Button>
      );
    case "request_sent":
      return (
        <Button
          icon={<Clock className="size-4" />}
          loading={busy}
          title="Cancel request"
          onClick={() => act.mutate({ kind: "cancel", username, requestId: data.requestId })}
          className="group"
        >
          <span className="group-hover:hidden">Request sent</span>
          <span className="hidden group-hover:inline">Cancel request</span>
        </Button>
      );
    case "request_received":
      return (
        <div className="flex gap-2">
          <Button
            variant="primary"
            icon={<Check className="size-4" />}
            loading={busy}
            onClick={() => act.mutate({ kind: "accept", username, requestId: data.requestId })}
          >
            Accept
          </Button>
          <Button
            variant="ghost"
            className="hover:bg-danger-soft hover:text-danger"
            icon={<X className="size-4" />}
            disabled={busy}
            onClick={() => act.mutate({ kind: "decline", username, requestId: data.requestId })}
          >
            Decline
          </Button>
        </div>
      );
    case "friends":
      return (
        <>
          <Button
            variant="public"
            icon={<UserCheck className="size-4" />}
            onClick={() => setConfirmRemove(true)}
            title="Remove friend"
            className="group"
          >
            <span className="group-hover:hidden">Friends</span>
            <span className="hidden group-hover:inline">Remove friend</span>
          </Button>
          <ConfirmDialog
            open={confirmRemove}
            title={`Remove @${username} as a friend?`}
            confirmLabel="Remove friend"
            loading={busy}
            onCancel={() => setConfirmRemove(false)}
            onConfirm={() =>
              act.mutate({ kind: "remove", username }, { onSettled: () => setConfirmRemove(false) })
            }
          >
            You'll both be removed from each other's friends. You can send a new request any time.
          </ConfirmDialog>
        </>
      );
  }
}

/** Your friends, with a way to remove each. */
export function FriendsList({ friends }: { friends: string[] }) {
  const act = useFriendAction();
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <Panel className="p-6">
      <PanelHeader
        title={
          <>
            Friends <span className="text-sm font-normal text-fg-subtle">{friends.length}</span>
          </>
        }
        accent="primary"
      />
      {friends.length === 0 ? (
        <p className="mt-3 text-sm text-fg-subtle">
          No friends yet. Visit someone's profile to send a request.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {friends.map((name) => (
            <FriendRow key={name} username={name} onRemove={() => setRemoving(name)} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        title={`Remove @${removing} as a friend?`}
        confirmLabel="Remove friend"
        loading={act.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          act.mutate({ kind: "remove", username: removing }, { onSettled: () => setRemoving(null) })
        }
      >
        You'll both be removed from each other's friends.
      </ConfirmDialog>
    </Panel>
  );
}

function FriendRow({ username, onRemove }: { username: string; onRemove: () => void }) {
  const { data } = useUserProfile(username);
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-raised p-2 pr-1 ring-1 ring-line">
      <Link
        to={`/profile/${username}`}
        className="flex min-w-0 flex-1 items-center gap-3 hover:text-primary"
      >
        <Avatar src={data?.profilePic?.url} name={username} size="sm" />
        <span className="truncate text-sm font-medium">@{username}</span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove @${username}`}
        title="Remove friend"
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-fg-subtle hover:bg-danger-soft hover:text-danger"
      >
        <UserMinus className="size-4" />
      </button>
    </li>
  );
}
