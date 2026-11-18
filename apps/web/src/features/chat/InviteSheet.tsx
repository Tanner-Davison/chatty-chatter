import { useState, type FormEvent } from "react";
import { AtSign, Check, Copy, RefreshCw, Share2, UserPlus } from "lucide-react";
import { usernameSchema, type Room } from "@chatty/shared";
import { Button, ConfirmDialog, Field, Input, Sheet, Spinner } from "../../components/ui";
import { inviteUrl, useAddMember, useResetInvite, useRoomInvite } from "../rooms/api";

/** A private hub's invite panel: share its link, or add someone by username. */
export function InviteSheet({
  room,
  isOwner,
  open,
  onClose,
}: {
  room: Room;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label="Invite people" className="flex flex-col gap-8">
      <header className="pr-10">
        <h2 className="font-display text-xl font-semibold">Invite people</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Anyone you invite joins{" "}
          <span className="font-medium text-fg capitalize">
            {room.room_name ?? `Hub #${room.room_number}`}
          </span>{" "}
          without a password, and it shows up in their hubs.
        </p>
      </header>
      <ShareLink roomNumber={room.room_number} isOwner={isOwner} />
      <AddByUsername roomNumber={room.room_number} />
    </Sheet>
  );
}

function ShareLink({ roomNumber, isOwner }: { roomNumber: number; isOwner: boolean }) {
  const invite = useRoomInvite(roomNumber, true);
  const reset = useResetInvite(roomNumber);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const url = invite.data && inviteUrl(invite.data.code);
  const canShare = typeof navigator.share === "function";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-fg-muted uppercase">Invite link</h3>
      {invite.isError ? (
        <p className="text-sm text-danger">Couldn't load the link. {invite.error.message}</p>
      ) : !url ? (
        <Spinner className="size-5" />
      ) : (
        <>
          <Input
            readOnly
            value={url}
            aria-label="Invite link"
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="private"
              icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              onClick={() => void copy()}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            {canShare && (
              <Button
                icon={<Share2 className="size-4" />}
                onClick={() => void navigator.share({ url }).catch(() => {})}
              >
                Share
              </Button>
            )}
            {isOwner && (
              <Button
                variant="ghost"
                icon={<RefreshCw className="size-4" />}
                loading={reset.isPending}
                onClick={() => setConfirmReset(true)}
              >
                Reset link
              </Button>
            )}
          </div>
          <p className="text-xs text-fg-subtle">
            Anyone with this link can join, so only send it to people you want inside.
          </p>
        </>
      )}
      <ConfirmDialog
        open={confirmReset}
        title="Reset invite link?"
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          reset.mutate();
          setConfirmReset(false);
        }}
      >
        The current link stops working. People already in the hub stay in.
      </ConfirmDialog>
    </section>
  );
}

function AddByUsername({ roomNumber }: { roomNumber: number }) {
  const add = useAddMember(roomNumber);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setAdded(undefined);
    const parsed = usernameSchema.safeParse(username.replace(/^@/, ""));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    add.mutate(parsed.data, {
      onSuccess: () => {
        setAdded(parsed.data);
        setUsername("");
      },
      onError: (err) => setError(err.message),
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-fg-muted uppercase">Add by username</h3>
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <Field
          label="Username"
          icon={<AtSign className="size-3.5" />}
          error={error}
          hint={added ? `@${added} is in. They'll get a notification.` : undefined}
        >
          {(props) => (
            <div className="flex gap-2">
              <Input
                {...props}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="their-username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <Button
                type="submit"
                variant="private"
                icon={<UserPlus className="size-4" />}
                loading={add.isPending}
                disabled={!username.trim()}
              >
                Add
              </Button>
            </div>
          )}
        </Field>
      </form>
    </section>
  );
}
