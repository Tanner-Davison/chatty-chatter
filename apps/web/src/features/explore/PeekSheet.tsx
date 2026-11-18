import { useNavigate } from "react-router";
import { BellPlus, DoorOpen, KeyRound, Lock, MessageCircle, Users } from "lucide-react";
import type { ChatMessage, DiscoverRoom } from "@chatty/shared";
import { Avatar, Badge, Button, LoadingBlock, Sheet } from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatMessageTime, timeAgo } from "../../lib/format";
import { useUserProfile } from "../profile/api";
import { useJoinRoom } from "../rooms/api";
import { useRoomPeek } from "./api";
import { CategoryIcon } from "./CategoryIcon";

/** A look inside a hub without joining it: stats, recent messages, and a way in. */
export function PeekSheet({
  roomNumber,
  onClose,
}: {
  roomNumber: number | null;
  onClose: () => void;
}) {
  const { data, isPending, isError } = useRoomPeek(roomNumber);
  return (
    <Sheet
      open={roomNumber !== null}
      onClose={onClose}
      label="Hub preview"
      footer={data && <PeekActions room={data.room} locked={data.locked} />}
    >
      {isPending ? (
        <LoadingBlock label="Peeking inside" />
      ) : isError ? (
        <p className="py-12 text-center text-fg-muted">
          This hub couldn't be loaded. It may have been deleted.
        </p>
      ) : (
        <PeekContent room={data.room} locked={data.locked} messages={data.messages} />
      )}
    </Sheet>
  );
}

function PeekContent({
  room,
  locked,
  messages,
}: {
  room: DiscoverRoom;
  locked: boolean;
  messages: ChatMessage[];
}) {
  const navigate = useNavigate();
  const { data: owner } = useUserProfile(room.created_by);
  const name = room.room_name?.trim() || `Hub #${room.room_number}`;

  const stats = [
    { icon: <Users />, label: "Members", value: room.users_in_room.length },
    { icon: <MessageCircle />, label: "Messages", value: room.messageCount },
    { label: "Last active", value: timeAgo(room.lastActiveAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 pr-10">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl ring-1 [&_svg]:size-6",
            room.private_room
              ? "bg-private-soft text-private ring-private/30"
              : "bg-public-soft text-public ring-public/30",
          )}
        >
          <CategoryIcon category={room.room_category} />
        </span>
        <h2 className="font-display text-2xl font-bold capitalize">{name}</h2>
        <div className="flex flex-wrap gap-2">
          {room.private_room ? (
            <Badge tone="private">
              <Lock /> Private
            </Badge>
          ) : (
            <Badge tone="public">Public</Badge>
          )}
          <Badge>{room.room_category ?? "General"}</Badge>
          <Badge>#{room.room_number}</Badge>
          {room.onlineCount > 0 && (
            <Badge tone="public">
              <span className="size-1.5 animate-pulse rounded-full bg-public" /> {room.onlineCount}{" "}
              online now
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => void navigate(`/profile/${room.created_by}`)}
          className="flex w-fit cursor-pointer items-center gap-2 text-sm text-fg-muted hover:text-fg"
        >
          <Avatar src={owner?.profilePic?.url} name={room.created_by} size="xs" />
          Created by <span className="font-medium text-fg">@{room.created_by}</span>
        </button>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface-raised p-3 ring-1 ring-line">
            <dt className="text-[11px] tracking-wide text-fg-subtle uppercase">{s.label}</dt>
            <dd className="font-display text-lg font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Recent messages" className="flex flex-col gap-2">
        <h3 className="text-xs font-medium tracking-wide text-fg-muted uppercase">
          Recent messages
        </h3>
        {locked ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-private-soft p-6 text-center ring-1 ring-private/30">
            <Lock className="size-6 text-private" />
            <p className="text-sm text-fg-muted">
              Messages in private hubs are only visible to members.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl bg-surface-raised p-6 text-center text-sm text-fg-subtle ring-1 ring-line">
            Nothing's been said yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {messages.map((m, i) => (
              <li
                key={m._id ?? i}
                className="rounded-xl bg-surface-raised px-3 py-2 ring-1 ring-line"
              >
                <p className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-fg-muted">@{m.sentBy}</span>
                  <span className="text-fg-subtle">{formatMessageTime(m.timestamp)}</span>
                </p>
                <p className="text-sm break-words">{m.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function PeekActions({ room, locked }: { room: DiscoverRoom; locked: boolean }) {
  const navigate = useNavigate();
  const join = useJoinRoom();
  const open = () => void navigate(`/chatroom/${room.room_number}`);
  return (
    <>
      {locked ? (
        <Button
          variant="private"
          size="lg"
          className="flex-1"
          icon={<KeyRound className="size-4" />}
          onClick={open}
        >
          Enter password
        </Button>
      ) : (
        <>
          {room.membership === "none" && (
            <Button
              size="lg"
              icon={<BellPlus className="size-4" />}
              loading={join.isPending}
              onClick={() => join.mutate({ roomNumber: room.room_number }, { onSuccess: open })}
            >
              Subscribe
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<DoorOpen className="size-4" />}
            onClick={open}
          >
            Open hub
          </Button>
        </>
      )}
    </>
  );
}
