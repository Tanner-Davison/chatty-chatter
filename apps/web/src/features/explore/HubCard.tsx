import { Crown, Flame, Lock, MessageCircle, Users } from "lucide-react";
import type { DiscoverRoom } from "@chatty/shared";
import { AvatarStack, Badge } from "../../components/ui";
import { cn } from "../../lib/cn";
import { timeAgo } from "../../lib/format";
import { HubCoverBackdrop } from "../rooms/HubCoverBackdrop";
import { CategoryIcon } from "./CategoryIcon";

interface HubCardProps {
  room: DiscoverRoom;
  onOpen: () => void;
  className?: string;
}

/** An explore card: what the hub is, who's in it and how alive it is. */
export function HubCard({ room, onOpen, className }: HubCardProps) {
  const name = room.room_name?.trim() || `Hub #${room.room_number}`;
  const tone = room.private_room ? "private" : "public";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Peek into ${name}`}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-surface-raised text-left ring-1 ring-line transition duration-200",
        "hover:-translate-y-0.5 hover:ring-line-strong",
        tone === "public" ? "hover:shadow-glow-public" : "hover:shadow-glow-private",
        className,
      )}
    >
      {/* Role stripe: emerald for public, violet for private. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 z-10 w-1",
          tone === "public" ? "bg-public" : "bg-private",
        )}
      />

      {/* The owner's cover sits behind the hub's name; the stats below stay plain. */}
      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <HubCoverBackdrop cover={room.cover_image} category={room.room_category} fallback />
        <div className="relative flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:size-5",
              tone === "public"
                ? "bg-public-soft text-public ring-public/30"
                : "bg-private-soft text-private ring-private/30",
            )}
          >
            <CategoryIcon category={room.room_category} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display font-semibold capitalize group-hover:text-fg">
              {name}
            </h3>
            <p className="truncate text-xs text-fg/70">
              {room.room_category ?? "General"} · #{room.room_number}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {room.onlineCount > 0 && (
              <Badge tone="public">
                <span className="size-1.5 animate-pulse rounded-full bg-public" />
                {room.onlineCount} online
              </Badge>
            )}
            {room.membership === "owner" && (
              <Badge tone="primary">
                <Crown /> Yours
              </Badge>
            )}
            {room.membership === "joined" && <Badge tone="primary">Joined</Badge>}
          </div>
        </div>

        <p className="relative line-clamp-2 min-h-10 text-sm text-fg/85">
          {room.private_room ? (
            <span className="flex items-center gap-1.5 text-fg/70">
              <Lock className="size-3.5" /> Private hub. Password required.
            </span>
          ) : room.lastMessage?.message ? (
            <>
              <span className="font-medium text-fg">@{room.lastMessage.sentBy}</span>{" "}
              {room.lastMessage.message}
            </>
          ) : (
            <span className="text-fg/70">No messages yet. Be the first!</span>
          )}
        </p>

        {room.friendsHere && room.friendsHere.length > 0 && (
          <p className="relative truncate text-xs text-primary">
            {room.friendsHere
              .slice(0, 2)
              .map((f) => `@${f}`)
              .join(", ")}
            {room.friendsHere.length > 2 && ` +${room.friendsHere.length - 2}`}{" "}
            {room.friendsHere.length === 1 ? "is" : "are"} here
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-surface-raised px-4 py-3 text-xs whitespace-nowrap text-fg-subtle">
        <AvatarStack
          usernames={room.memberPreview.slice(0, 3)}
          total={room.users_in_room.length}
          className="hidden min-[400px]:flex"
        />
        <span className="flex items-center gap-1">
          <Users className="size-3.5" /> {room.users_in_room.length}
        </span>
        <span
          className="flex items-center gap-1"
          title={
            room.recentMessageCount > 0
              ? `${room.recentMessageCount} messages today`
              : `${room.messageCount} messages`
          }
        >
          {room.recentMessageCount > 0 ? (
            <Flame className="size-3.5 text-warning" />
          ) : (
            <MessageCircle className="size-3.5" />
          )}
          {room.recentMessageCount > 0 ? `${room.recentMessageCount} today` : room.messageCount}
        </span>
        <span className="ml-auto">{timeAgo(room.lastActiveAt)}</span>
      </div>
    </button>
  );
}
