import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { MESSAGE_MAX_LENGTH, splitMentions } from "@chatty/shared";
import { Avatar, Button } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useUserProfile } from "../profile/api";
import { findMentionQuery, insertMention, rankMentions } from "./mentionAutocomplete";

interface ComposerProps {
  onSend: (text: string) => void;
  onTyping: () => void;
  /** People who can be @mentioned in this room. */
  mentionables: string[];
  disabled?: boolean;
}

/** Message box with @mention suggestions. Enter sends; with suggestions open, Enter/Tab picks one. */
export function Composer({ onSend, onTyping, mentionables, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);
  const syncMirror = () => {
    if (mirror.current && input.current) {
      mirror.current.style.transform = `translateX(${-input.current.scrollLeft}px)`;
    }
  };
  const trimmed = text.trim();

  const mention = findMentionQuery(text, caret);
  const suggestions =
    mention && mention.start !== dismissedAt ? rankMentions(mentionables, mention.query) : [];
  const open = suggestions.length > 0;
  const selected = Math.min(active, suggestions.length - 1);

  const pick = (username: string) => {
    if (!mention) return;
    const next = insertMention(text, mention.start, caret, username);
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((selected + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[selected]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDismissedAt(mention!.start);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || disabled || open) return;
    onSend(trimmed);
    setText("");
    setCaret(0);
  };

  return (
    <form onSubmit={submit} className="relative flex items-center gap-2">
      {open && (
        <ul
          id="mention-suggestions"
          role="listbox"
          aria-label="People to mention"
          className="absolute bottom-full left-0 z-20 mb-2 w-72 animate-fade-up overflow-hidden rounded-xl bg-surface-overlay p-1 shadow-panel ring-1 ring-line-strong"
        >
          {suggestions.map((username, i) => (
            <Suggestion
              key={username}
              username={username}
              selected={i === selected}
              onPick={() => pick(username)}
              onHover={() => setActive(i)}
            />
          ))}
        </ul>
      )}
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      {/* The input's own text is transparent; this mirror behind it draws the
          same text with @mentions coloured, kept aligned as the input scrolls. */}
      <div className="relative flex-1 rounded-xl bg-ink-950/60 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-primary">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 inset-y-0 flex items-center overflow-hidden text-[15px] whitespace-pre"
        >
          <span ref={mirror}>
            <HighlightedText text={text} mentionables={mentionables} />
          </span>
        </div>
        <input
          ref={input}
          id="composer"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setActive(0);
            setDismissedAt(null);
            if (e.target.value) onTyping();
            requestAnimationFrame(syncMirror);
          }}
          onSelect={(e) => {
            setCaret(e.currentTarget.selectionStart ?? 0);
            syncMirror();
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="mention-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={open ? `mention-${suggestions[selected]}` : undefined}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={disabled ? "Reconnecting…" : "Message… (type @ to mention someone)"}
          autoComplete="off"
          onScroll={syncMirror}
          className="relative h-12 w-full rounded-xl bg-transparent px-4 text-[15px] text-transparent caret-fg placeholder:text-fg-subtle selection:bg-primary/30 selection:text-fg focus:outline-none"
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={!trimmed || disabled}
        icon={<SendHorizontal className="size-4" />}
      >
        <span className="hidden sm:inline">Send</span>
      </Button>
    </form>
  );
}

function Suggestion({
  username,
  selected,
  onPick,
  onHover,
}: {
  username: string;
  selected: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const { data } = useUserProfile(username);
  return (
    <li
      id={`mention-${username}`}
      role="option"
      aria-selected={selected}
      // Keep focus in the input so typing continues.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      onMouseEnter={onHover}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
        selected ? "bg-primary-soft text-primary" : "text-fg-muted",
      )}
    >
      <Avatar src={data?.profilePic?.url} name={username} size="xs" />
      <span className="truncate">@{username}</span>
    </li>
  );
}

/**
 * The composer text with mentions of people in the room in cyan, so you can
 * see who will be notified. Only colour changes: anything that changed widths
 * (padding, bold) would knock the mirror out of line with the real input.
 */
function HighlightedText({ text, mentionables }: { text: string; mentionables: string[] }) {
  const known = new Set(mentionables.map((m) => m.toLowerCase()));
  return splitMentions(text).map((part, i) =>
    part.mention && known.has(part.mention) ? (
      <span key={i} className="rounded-sm bg-primary-soft text-primary">
        {part.text}
      </span>
    ) : (
      <span key={i} className="text-fg">
        {part.text}
      </span>
    ),
  );
}
