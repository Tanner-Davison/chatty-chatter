import { useState } from "react";
import { AtSign, ChevronDown, ChevronUp, X } from "lucide-react";
import { useMarkRead, useNotifications } from "../notifications/api";
import type { ChatEntry } from "./chatReducer";

interface MentionNavigatorProps {
  room: number;
  messages: ChatEntry[];
  me: string;
  onJump: (messageKey: string) => void;
}

/**
 * Appears when you're mentioned more than once in a hub. Steps through your
 * mentions, starting at the first one you haven't seen yet.
 */
export function MentionNavigator({ room, messages, me, onJump }: MentionNavigatorProps) {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const [cursor, setCursor] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const mentions = messages.filter((m) => m.sentBy !== me && m.mentions?.includes(me));
  if (mentions.length < 2 || dismissed) return null;

  // Unseen = its notification is still unread.
  const unread = new Map(
    (data?.notifications ?? [])
      .flatMap((n) => (n.type === "mention" && n.room === room && !n.read ? [n] : []))
      .map((n) => [n.messageId, n._id]),
  );
  const unseen = mentions.filter((m) => unread.has(m.key)).length;
  const firstUnseen = Math.max(
    0,
    mentions.findIndex((m) => unread.has(m.key)),
  );

  const go = (index: number) => {
    const target = mentions[(index + mentions.length) % mentions.length]!;
    setCursor((index + mentions.length) % mentions.length);
    onJump(target.key);
    const notificationId = unread.get(target.key);
    if (notificationId) markRead.mutate([notificationId]);
  };
  const next = () => go(cursor === null ? firstUnseen : cursor + 1);
  const prev = () => go(cursor === null ? firstUnseen : cursor - 1);

  return (
    <div
      role="toolbar"
      aria-label="Your mentions"
      className="absolute top-3 right-3 z-10 flex animate-fade-up items-center gap-0.5 rounded-full bg-surface-overlay/95 py-1 pr-1 pl-3 text-xs shadow-panel ring-1 ring-warning/40 backdrop-blur"
    >
      <AtSign className="size-3.5 text-warning" />
      <span className="mr-1 ml-1 tabular-nums text-fg-muted">
        {cursor === null ? (
          <>
            {mentions.length} mentions
            {unseen > 0 && <span className="text-warning"> · {unseen} new</span>}
          </>
        ) : (
          `${cursor + 1} of ${mentions.length}`
        )}
      </span>
      <NavButton label="Previous mention" onClick={prev}>
        <ChevronUp />
      </NavButton>
      <NavButton
        label={cursor === null && unseen > 0 ? "First unseen mention" : "Next mention"}
        onClick={next}
      >
        <ChevronDown />
      </NavButton>
      <NavButton label="Hide" onClick={() => setDismissed(true)}>
        <X />
      </NavButton>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded-full text-fg-muted hover:bg-ink-700 hover:text-fg [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
