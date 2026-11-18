import { useDeferredValue, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Compass, Dices, Search, Sparkles, Users } from "lucide-react";
import {
  DISCOVER_SORTS,
  ROOM_CATEGORIES,
  type DiscoverRoom,
  type DiscoverSort,
  type RoomCategory,
} from "@chatty/shared";
import { Button, LoadingBlock, Panel, PanelHeader } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useMyRooms } from "../rooms/api";
import { useDiscover, useFriendRooms, useSurprise } from "./api";
import { CATEGORY_ICONS } from "./categoryIcons";
import { HubCard } from "./HubCard";
import { PeekSheet } from "./PeekSheet";

const SORT_LABELS: Record<DiscoverSort, string> = {
  trending: "Trending",
  active: "Recently active",
  members: "Most members",
  newest: "Newest",
};

const isCategory = (v: string | null): v is RoomCategory =>
  ROOM_CATEGORIES.includes(v as RoomCategory);
const isSort = (v: string | null): v is DiscoverSort => DISCOVER_SORTS.includes(v as DiscoverSort);

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const category = isCategory(params.get("category"))
    ? (params.get("category") as RoomCategory)
    : undefined;
  const sort = isSort(params.get("sort")) ? (params.get("sort") as DiscoverSort) : "trending";
  const peek = Number(params.get("peek")) || null;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDeferredValue(search.trim());

  const update = (changes: Record<string, string | undefined>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  };

  const discover = useDiscover({ sort, category, q: q || undefined });
  const friends = useFriendRooms();
  const filtering = Boolean(category || q || sort !== "trending");
  const rooms = discover.data ?? [];
  // The trending sort ranks online and today's activity first, then recency.
  const trending = rooms.slice(0, 8);
  const openPeek = (room: DiscoverRoom) => update({ peek: String(room.room_number) });
  const favorites = useFavoriteCategories();
  const surprise = useSurprise();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <Compass className="size-8 text-primary" /> Explore hubs
          </h1>
          <p className="text-fg-muted">
            Find where the chatter is. Peek inside before you jump in.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="public"
            size="lg"
            icon={<Dices className="size-5" />}
            loading={surprise.isPending}
            onClick={() =>
              surprise.mutate(undefined, {
                onSuccess: ({ room_number }) => void navigate(`/chatroom/${room_number}`),
              })
            }
          >
            Surprise me
          </Button>
          {surprise.isError && <p className="text-xs text-danger">{surprise.error.message}</p>}
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search hubs</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              update({ q: e.target.value.trim() || undefined }, true);
            }}
            placeholder="Search hub names"
            className="h-11 w-full rounded-xl bg-ink-950/60 pr-3 pl-10 text-sm ring-1 ring-line-strong placeholder:text-fg-subtle focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Sort hubs"
          className="flex gap-1 overflow-x-auto rounded-xl bg-ink-950/60 p-1 ring-1 ring-line"
        >
          {DISCOVER_SORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sort === s}
              onClick={() => update({ sort: s === "trending" ? undefined : s })}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition",
                sort === s ? "bg-primary-soft text-primary" : "text-fg-muted hover:text-fg",
              )}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <CategoryChip
          active={!category}
          onClick={() => update({ category: undefined })}
          icon={<Sparkles />}
          label="All"
        />
        {ROOM_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          return (
            <CategoryChip
              key={c}
              active={category === c}
              onClick={() => update({ category: category === c ? undefined : c })}
              icon={<Icon />}
              label={c}
            />
          );
        })}
      </nav>

      {discover.isPending ? (
        <LoadingBlock label="Finding hubs" />
      ) : discover.isError ? (
        <p className="text-center text-danger">Couldn't load hubs. {discover.error.message}</p>
      ) : (
        <>
          {!filtering && trending.length > 0 && (
            <Row title="Trending now" accent="public" rooms={trending} onOpen={openPeek} />
          )}
          {!filtering &&
            favorites.map((c) => <CategoryRow key={c} category={c} onOpen={openPeek} />)}
          {!filtering && friends.data && friends.data.length > 0 && (
            <Row
              title="Your friends are here"
              accent="primary"
              icon={<Users className="size-4" />}
              rooms={friends.data}
              onOpen={openPeek}
            />
          )}
          <section className="flex flex-col gap-3">
            <PanelHeader
              title={
                filtering ? `${rooms.length} ${rooms.length === 1 ? "hub" : "hubs"}` : "All hubs"
              }
              accent="neutral"
            />
            {rooms.length === 0 ? (
              <Panel className="p-10 text-center text-fg-muted">
                No hubs match. {category && "Try another category, or "}start one yourself!
              </Panel>
            ) : (
              <div
                className={cn(
                  "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
                  discover.isPlaceholderData && "opacity-60",
                )}
              >
                {rooms.map((room) => (
                  <HubCard key={room._id} room={room} onOpen={() => openPeek(room)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <PeekSheet roomNumber={peek} onClose={() => update({ peek: undefined })} />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ring-1 transition [&_svg]:size-3.5",
        active
          ? "bg-primary-soft text-primary ring-primary/50"
          : "bg-surface-raised text-fg-muted ring-line hover:text-fg hover:ring-line-strong",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({
  title,
  accent,
  icon,
  rooms,
  onOpen,
}: {
  title: string;
  accent: "public" | "primary";
  icon?: ReactNode;
  rooms: DiscoverRoom[];
  onOpen: (room: DiscoverRoom) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            {title} {icon}
          </span>
        }
        accent={accent}
      />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {rooms.map((room) => (
          <HubCard
            key={room._id}
            room={room}
            onOpen={() => onOpen(room)}
            className="w-72 shrink-0 snap-start"
          />
        ))}
      </div>
    </section>
  );
}

/** The (up to two) categories the user is most into, from hubs they created or joined. */
function useFavoriteCategories(): RoomCategory[] {
  const { data } = useMyRooms();
  if (!data) return [];
  const counts = new Map<RoomCategory, number>();
  for (const room of [...data.created, ...data.joined]) {
    if (isCategory(room.room_category ?? null)) {
      const c = room.room_category as RoomCategory;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([c]) => c);
}

/** "More in Gaming": hubs in a favourite category the user isn't in yet. */
function CategoryRow({
  category,
  onOpen,
}: {
  category: RoomCategory;
  onOpen: (room: DiscoverRoom) => void;
}) {
  const { data } = useDiscover({ sort: "trending", category });
  const rooms = (data ?? []).filter((r) => r.membership === "none").slice(0, 8);
  if (rooms.length === 0) return null;
  const Icon = CATEGORY_ICONS[category];
  return (
    <Row
      title={`More in ${category}`}
      accent="public"
      icon={<Icon className="size-4" />}
      rooms={rooms}
      onOpen={onOpen}
    />
  );
}
