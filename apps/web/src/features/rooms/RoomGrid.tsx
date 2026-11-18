import { useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import type { MyRoom } from "@chatty/shared";
import { IconButton, Panel, PanelHeader } from "../../components/ui";
import { RoomCard, type RoomKind } from "./RoomCard";

const PAGE_SIZE = 6;

const accentFor = {
  subscribed: "primary",
  public: "public",
  private: "private",
} as const;

interface RoomGridProps {
  title: string;
  kind: RoomKind;
  rooms: MyRoom[];
  emptyText: string;
  onLeave?: (room: MyRoom) => void;
  onDelete?: (room: MyRoom) => void;
}

/** One dashboard section: a page of hub tiles, or every tile in "view all" mode. */
export function RoomGrid({ title, kind, rooms, emptyText, onLeave, onDelete }: RoomGridProps) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);

  // Hubs with something new first, then the most recently active.
  const visible = rooms
    .filter((r) => !hidden.has(r._id))
    .sort(
      (a, b) =>
        Number(b.unreadCount + b.unreadMentions > 0) -
          Number(a.unreadCount + a.unreadMentions > 0) ||
        b.lastActiveAt.localeCompare(a.lastActiveAt),
    );
  const newCount = visible.reduce((sum, r) => sum + r.unreadCount, 0);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const shown = showAll ? visible : visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <Panel className="p-4 sm:p-5">
      <PanelHeader
        title={
          <>
            {title} <span className="text-sm font-normal text-fg-subtle">{visible.length}</span>
            {newCount > 0 && (
              <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/40">
                {newCount} new
              </span>
            )}
          </>
        }
        accent={accentFor[kind]}
        actions={
          visible.length > PAGE_SIZE && (
            <IconButton
              label={showAll ? "Show one page" : "View all"}
              size="sm"
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? <Rows3 /> : <LayoutGrid />}
            </IconButton>
          )
        }
      />

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-subtle">{emptyText}</p>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,9.5rem)] sm:justify-center sm:gap-4">
          {shown.map((room) => (
            <RoomCard
              key={room._id}
              room={room}
              kind={kind}
              onHide={() => setHidden((h) => new Set(h).add(room._id))}
              onLeave={onLeave && (() => onLeave(room))}
              onDelete={onDelete && (() => onDelete(room))}
            />
          ))}
        </div>
      )}

      {!showAll && pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-fg-muted">
          <IconButton
            label="Previous page"
            size="sm"
            onClick={() => setPage((current - 1 + pageCount) % pageCount)}
          >
            <ChevronLeft />
          </IconButton>
          <span className="min-w-12 text-center tabular-nums">
            {current + 1} / {pageCount}
          </span>
          <IconButton
            label="Next page"
            size="sm"
            onClick={() => setPage((current + 1) % pageCount)}
          >
            <ChevronRight />
          </IconButton>
        </div>
      )}
    </Panel>
  );
}
