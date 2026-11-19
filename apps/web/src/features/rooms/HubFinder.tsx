import { useDeferredValue, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Hash, Lock, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { useRoomSearch } from "./api";

/** Searches hubs by name. */
export function HubFinder({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const trimmed = query.trim();
  const deferred = useDeferredValue(trimmed);
  const { data: results = [], isFetching } = useRoomSearch(deferred);

  const go = (roomNumber: number) => {
    setQuery("");
    setOpen(false);
    void navigate(`/chatroom/${roomNumber}`);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (results[0]) go(results[0].room_number);
  };

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <label className="sr-only" htmlFor="hub-finder">
        Find a hub by name
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
      />
      <input
        id="hub-finder"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Find a hub by name"
        autoComplete="off"
        className="h-10 w-full rounded-xl bg-ink-950/60 pr-3 pl-9 text-sm ring-1 ring-line-strong placeholder:text-fg-subtle focus:ring-2 focus:ring-primary focus:outline-none"
      />
      {open && trimmed && (
        <ul className="absolute top-full right-0 left-0 z-40 mt-1 max-h-72 animate-fade-up overflow-y-auto rounded-xl bg-surface-overlay p-1 shadow-panel ring-1 ring-line-strong">
          {results.length > 0 ? (
            results.map((room) => (
              <ResultButton
                key={room._id}
                onClick={() => go(room.room_number)}
                icon={
                  room.private_room ? (
                    <Lock className="text-private" />
                  ) : (
                    <Hash className="text-public" />
                  )
                }
                label={room.room_name?.trim() || "Untitled hub"}
                meta={room.room_category}
              />
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-fg-subtle">
              {isFetching ? "Searching…" : "No hubs found"}
            </li>
          )}
        </ul>
      )}
    </form>
  );
}

function ResultButton({
  onClick,
  icon,
  label,
  meta,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <li>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg-muted hover:bg-ink-700 hover:text-fg [&_svg]:size-4"
      >
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {meta && <span className="text-xs text-fg-subtle">{meta}</span>}
      </button>
    </li>
  );
}
