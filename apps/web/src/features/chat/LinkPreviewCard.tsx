import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { LinkPreview } from "@chatty/shared";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { useCurrentUser } from "../auth/currentUser";

// Previews someone hid just for themselves, per account: two people sharing a
// browser (or testing two accounts side by side) don't share each other's hides.
const hiddenKey = (username: string) => `chatty:hidden-previews:${username}`;

function readHidden(username: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(username)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function hideLocally(username: string, id: string) {
  try {
    const ids = [...readHidden(username), id].slice(-500);
    localStorage.setItem(hiddenKey(username), JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode); hiding still works for this visit.
  }
}

function useLinkPreview(url: string) {
  return useQuery({
    queryKey: ["link-preview", url],
    // 204 (nothing to show) arrives as undefined, which TanStack Query doesn't allow.
    queryFn: async () =>
      (await api.get<LinkPreview | undefined>(`/link-preview?url=${encodeURIComponent(url)}`)) ??
      null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

interface LinkPreviewCardProps {
  url: string;
  messageId: string;
  isOwn: boolean;
  /** Removes the preview for everyone; only offered on your own messages. */
  onRemove: () => void;
}

/** A Slack-style unfurl under a message: site, title, description and image. */
export function LinkPreviewCard({ url, messageId, isOwn, onRemove }: LinkPreviewCardProps) {
  const { data: preview } = useLinkPreview(url);
  const { username } = useCurrentUser();
  const [hidden, setHidden] = useState(() => readHidden(username).has(`${messageId}:${url}`));
  if (!preview || hidden) return null;

  const hide = () => {
    if (isOwn) return onRemove();
    hideLocally(username, `${messageId}:${url}`);
    setHidden(true);
  };

  return (
    <div className="group/preview relative mt-1 flex w-full max-w-md animate-fade-up overflow-hidden rounded-xl bg-surface-raised ring-1 ring-line">
      <span aria-hidden className="w-1 shrink-0 bg-primary/60" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 flex-col gap-1 p-3 pr-9 hover:bg-surface-overlay/50"
      >
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          {preview.favicon && (
            <img
              src={preview.favicon}
              alt=""
              className="size-3.5 rounded-sm"
              loading="lazy"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
          <span className="truncate">{preview.siteName}</span>
        </span>
        {preview.title && (
          <span className="line-clamp-2 font-display text-sm font-semibold text-primary">
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className="line-clamp-2 text-xs text-fg-muted">{preview.description}</span>
        )}
        {preview.image && (
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            onError={(e) => e.currentTarget.remove()}
            className={cn(
              "mt-1 max-h-40 w-full rounded-lg object-cover ring-1 ring-line",
              !preview.title && "mt-0",
            )}
          />
        )}
      </a>
      <button
        type="button"
        onClick={hide}
        aria-label={isOwn ? "Remove preview for everyone" : "Hide preview for you"}
        title={isOwn ? "Remove preview for everyone" : "Hide preview for you"}
        className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle opacity-70 transition hover:bg-ink-700 hover:text-fg group-hover/preview:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
