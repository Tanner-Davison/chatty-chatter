import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { GifResult } from "@chatty/shared";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";

const PAGE_SIZE = 24;
const SEARCH_DELAY_MS = 300;

function useGifs(query: string) {
  return useInfiniteQuery({
    queryKey: ["gifs", query],
    queryFn: ({ pageParam }) =>
      api.get<GifResult[]>(`/gifs?q=${encodeURIComponent(query)}&offset=${pageParam}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

interface GifPickerProps {
  onPick: (gif: GifResult) => void;
  onClose: () => void;
}

/** Search GIPHY (trending until you type) and pick a GIF to send. */
export function GifPicker({ onPick, onClose }: GifPickerProps) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useGifs(query);
  const gifs = data?.pages.flat() ?? [];

  // Search once typing pauses rather than on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // Close on Escape or a click anywhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  // Load the next page when the bottom of the grid scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Choose a GIF"
      className="absolute bottom-full left-0 z-20 mb-2 flex h-[26rem] max-h-[60vh] w-[min(24rem,calc(100vw-2rem))] animate-fade-up flex-col overflow-hidden rounded-xl bg-surface-overlay shadow-panel ring-1 ring-line-strong"
    >
      <div className="relative border-b border-line p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-fg-subtle" />
        <label htmlFor="gif-search" className="sr-only">
          Search GIFs
        </label>
        <input
          id="gif-search"
          // The picker opens on purpose, so start typing right away.
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={100}
          placeholder="Search GIPHY"
          autoComplete="off"
          className="w-full rounded-lg bg-ink-950/60 py-2 pr-3 pl-8 text-sm text-fg ring-1 ring-line-strong placeholder:text-fg-subtle focus:ring-2 focus:ring-primary focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isPending ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : error ? (
          <p className="p-4 text-center text-sm text-fg-subtle">{error.message}</p>
        ) : gifs.length === 0 ? (
          <p className="p-4 text-center text-sm text-fg-subtle">No GIFs found for “{query}”.</p>
        ) : (
          <>
            <div className="columns-2 gap-1.5">
              {gifs.map((gif, i) => (
                <button
                  // GIPHY can repeat a GIF across pages.
                  key={`${gif.id}-${i}`}
                  type="button"
                  onClick={() => onPick(gif)}
                  aria-label={gif.title || "GIF"}
                  title={gif.title}
                  className="mb-1.5 block w-full cursor-pointer overflow-hidden rounded-lg bg-ink-800 ring-primary transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
                  style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                >
                  <img src={gif.preview} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
            <div ref={sentinel} className="flex h-8 items-center justify-center">
              {isFetchingNextPage && <Spinner className="size-4 text-primary" />}
            </div>
          </>
        )}
      </div>

      <p className="border-t border-line px-3 py-1.5 text-right text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
        Powered by GIPHY
      </p>
    </div>
  );
}
