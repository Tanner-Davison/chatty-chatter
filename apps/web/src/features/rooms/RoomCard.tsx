import type { CSSProperties } from "react";
import { useNavigate } from "react-router";
import {
  DoorOpen,
  EllipsisVertical,
  EyeOff,
  Lock,
  LogOut,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import type { MyRoom } from "@chatty/shared";
import { Avatar, Menu, type MenuItem } from "../../components/ui";
import { cn } from "../../lib/cn";
import { timeAgo } from "../../lib/format";
import { useUserProfile } from "../profile/api";
import { HubCoverBackdrop } from "./HubCoverBackdrop";

export type RoomKind = "subscribed" | "public" | "private";

// Each section's tile takes its role colour.
const TILE_COLORS: Record<RoomKind, string> = {
  // Cyan so subscribed tiles stay distinct from your green public ones.
  subscribed: "#22d3ee",
  public: "var(--color-public)",
  private: "var(--color-private)",
};

interface RoomCardProps {
  room: MyRoom;
  kind: RoomKind;
  onHide: () => void;
  onLeave?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}

export function RoomCard({ room, kind, onHide, onLeave, onDelete }: RoomCardProps) {
  const navigate = useNavigate();
  const { data: owner } = useUserProfile(room.created_by);
  const open = () => void navigate(`/chatroom/${room.room_number}`);
  const name = room.room_name?.trim() || `Hub #${room.room_number}`;
  const hasNews = room.unreadCount > 0 || room.unreadMentions > 0;

  const items: MenuItem[] = [
    { label: "Visit hub", icon: <DoorOpen />, onSelect: open },
    {
      label: "Owner's profile",
      icon: <UserRound />,
      onSelect: () => void navigate(`/profile/${room.created_by}`),
    },
    { label: "Hide for now", icon: <EyeOff />, onSelect: onHide },
  ];
  if (onLeave)
    items.push({ label: "Unsubscribe", icon: <LogOut />, onSelect: onLeave, tone: "danger" });
  if (onDelete)
    items.push({ label: "Delete hub", icon: <Trash2 />, onSelect: onDelete, tone: "danger" });

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      aria-label={`${name}, hub ${room.room_number}${room.private_room ? ", private" : ""}${
        room.unreadCount > 0 ? `, ${room.unreadCount} new messages` : ""
      }${room.unreadMentions > 0 ? `, ${room.unreadMentions} mentions of you` : ""}`}
      title={`#${room.room_number}`}
      style={{ "--tile-color": TILE_COLORS[kind] } as CSSProperties}
      className={cn(
        "group tile-checker relative flex aspect-square w-full cursor-pointer flex-col rounded-tile",
        "ring-1 ring-[color-mix(in_oklab,var(--tile-color)_45%,transparent)] transition duration-200",
        "hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--tile-color),0_12px_32px_-8px_var(--tile-color)]",
        "focus-visible:-translate-y-1",
        // Hubs with something new glow so they're easy to spot.
        hasNews && "ring-2 ring-primary shadow-glow-primary",
      )}
    >
      {/* The owner's cover fills the tile above the stats strip. */}
      <div className="relative flex flex-1 flex-col justify-between p-3">
        <HubCoverBackdrop cover={room.cover_image} width={400} className="rounded-t-tile" />
        <div className="relative z-10 flex items-start justify-between">
          <Avatar src={owner?.profilePic?.url} name={room.created_by} size="xs" />
          <div className="ml-auto flex items-center gap-1">
            {room.unreadMentions > 0 && (
              <span
                title={`${room.unreadMentions} mention${room.unreadMentions === 1 ? "" : "s"} of you`}
                className="flex h-5 items-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-ink-950"
              >
                @{room.unreadMentions > 1 ? room.unreadMentions : ""}
              </span>
            )}
            {room.unreadCount > 0 && (
              <span className="flex h-5 items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-fg">
                {room.unreadCount > 99 ? "99+" : room.unreadCount} new
              </span>
            )}
          </div>
          <Menu
            items={items}
            trigger={(props) => (
              <button
                type="button"
                aria-label={`${name} menu`}
                className="-mt-1 -mr-1 flex size-7 cursor-pointer items-center justify-center rounded-lg text-fg/70 hover:bg-ink-950/50 hover:text-fg"
                {...props}
              >
                <EllipsisVertical className="size-4" />
              </button>
            )}
          />
        </div>

        <div className="relative flex min-w-0 flex-col items-center gap-0.5 text-center">
          <p className="line-clamp-2 font-display text-sm font-semibold break-words text-fg capitalize">
            {name}
          </p>
          {room.lastMessage?.message && (
            <p className={cn("w-full truncate text-[11px]", hasNews ? "text-fg" : "text-fg/60")}>
              <span className="font-semibold">@{room.lastMessage.sentBy}</span>{" "}
              {room.lastMessage.message}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-between px-3 pb-3 text-[11px] text-fg/70",
          room.cover_image && "rounded-b-tile border-t border-line bg-surface-raised pt-2 pb-2",
        )}
      >
        <span title={new Date(room.lastActiveAt).toLocaleString()}>
          {timeAgo(room.lastActiveAt)}
        </span>
        <span className="flex items-center gap-1">
          {room.private_room ? <Lock className="size-3" /> : <Users className="size-3" />}
          {room.users_in_room.length}
        </span>
      </div>
    </div>
  );
}
