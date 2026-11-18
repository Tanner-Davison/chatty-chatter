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
import type { RoomSummary } from "@chatty/shared";
import { Avatar, Menu, type MenuItem } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useUserProfile } from "../profile/api";

export type RoomKind = "subscribed" | "public" | "private";

// Each section's tile takes its role colour.
const TILE_COLORS: Record<RoomKind, string> = {
  subscribed: "var(--color-primary)",
  public: "var(--color-public)",
  private: "var(--color-private)",
};

interface RoomCardProps {
  room: RoomSummary;
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
      aria-label={`${name}, hub ${room.room_number}${room.private_room ? ", private" : ""}`}
      style={{ "--tile-color": TILE_COLORS[kind] } as CSSProperties}
      className={cn(
        "group tile-checker relative flex aspect-square w-full cursor-pointer flex-col justify-between rounded-tile p-3",
        "ring-1 ring-[color-mix(in_oklab,var(--tile-color)_45%,transparent)] transition duration-200",
        "hover:-translate-y-1 hover:shadow-[0_0_0_1px_var(--tile-color),0_12px_32px_-8px_var(--tile-color)]",
        "focus-visible:-translate-y-1",
      )}
    >
      <div className="flex items-start justify-between">
        <Avatar src={owner?.profilePic?.url} name={room.created_by} size="xs" />
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

      <p className="line-clamp-2 text-center font-display text-sm font-semibold break-words text-fg capitalize">
        {name}
      </p>

      <div className="flex items-center justify-between text-[11px] text-fg/70">
        <span>#{room.room_number}</span>
        <span className="flex items-center gap-1">
          {room.private_room ? <Lock className="size-3" /> : <Users className="size-3" />}
          {room.users_in_room.length}
        </span>
      </div>
    </div>
  );
}
