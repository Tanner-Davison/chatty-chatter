import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Bold, Code, Italic, SendHorizontal, SquareCode, Strikethrough } from "lucide-react";
import { MESSAGE_MAX_LENGTH, splitMentions } from "@chatty/shared";
import { Avatar, Button } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useUserProfile } from "../profile/api";
import { insertCodeBlock, insideOpenFence, toggleWrap, type Edit } from "./editorFormat";
import { findMentionQuery, insertMention, rankMentions } from "./mentionAutocomplete";

interface ComposerProps {
  onSend: (text: string) => void;
  onTyping: () => void;
  /** People who can be @mentioned in this room. */
  mentionables: string[];
  disabled?: boolean;
}

const MAX_HEIGHT_PX = 260;
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

/**
 * Slack-style message editor: multi-line, a formatting toolbar and shortcuts,
 * and @mention suggestions. Enter sends; Shift+Enter (or Enter inside an open
 * ``` block) starts a new line.
 */
export function Composer({ onSend, onTyping, mentionables, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const trimmed = text.trim();

  // No suggestions inside code: mentions there don't notify anyone.
  const mention = insideOpenFence(text, caret) ? null : findMentionQuery(text, caret);
  const suggestions =
    mention && mention.start !== dismissedAt ? rankMentions(mentionables, mention.query) : [];
  const open = suggestions.length > 0;
  const selected = Math.min(active, suggestions.length - 1);

  // Grow with the text up to a limit, then scroll.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const selection = pendingSelection.current;
    if (selection) {
      pendingSelection.current = null;
      el.focus();
      el.setSelectionRange(selection.start, selection.end);
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
    syncMirror();
  }, [text]);

  function syncMirror() {
    if (mirror.current && area.current) {
      mirror.current.style.transform = `translateY(${-area.current.scrollTop}px)`;
    }
  }

  // Selection to restore once an edit's new text is in the textarea. Done in a
  // layout effect, before the next keystroke is handled, so fast typing after
  // Tab or a shortcut never lands at a stale cursor position.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const apply = (edit: Edit) => {
    pendingSelection.current = { start: edit.start, end: edit.end };
    setText(edit.text);
    setCaret(edit.end);
  };

  const format = (kind: "bold" | "italic" | "strike" | "code" | "block") => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    if (kind === "block") return apply(insertCodeBlock(text, start, end));
    const marker = { bold: "*", italic: "_", strike: "~", code: "`" }[kind];
    apply(toggleWrap(text, start, end, marker));
  };

  const pick = (username: string) => {
    if (!mention) return;
    const next = insertMention(text, mention.start, caret, username);
    apply({ text: next.text, start: next.caret, end: next.caret });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((selected + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[selected]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedAt(mention!.start);
        return;
      }
    }

    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey) {
      const shortcut =
        key === "b"
          ? "bold"
          : key === "i"
            ? "italic"
            : key === "e"
              ? "code"
              : e.shiftKey && key === "x"
                ? "strike"
                : e.shiftKey && key === "c"
                  ? "block"
                  : null;
      if (shortcut) {
        e.preventDefault();
        format(shortcut);
        return;
      }
    }

    const el = e.currentTarget;
    const inCode = insideOpenFence(text, el.selectionStart);
    if (e.key === "Tab" && inCode && !e.shiftKey) {
      e.preventDefault();
      const start = el.selectionStart;
      apply({
        text: text.slice(0, start) + "  " + text.slice(el.selectionEnd),
        start: start + 2,
        end: start + 2,
      });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !inCode && !e.nativeEvent.isComposing) {
      e.preventDefault();
      form.current?.requestSubmit();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || disabled || open) return;
    onSend(trimmed);
    setText("");
    setCaret(0);
  };

  const tools: {
    kind: Parameters<typeof format>[0];
    label: string;
    keys: string;
    icon: ReactNode;
  }[] = [
    { kind: "bold", label: "Bold", keys: `${mod}B`, icon: <Bold /> },
    { kind: "italic", label: "Italic", keys: `${mod}I`, icon: <Italic /> },
    { kind: "strike", label: "Strikethrough", keys: `${mod}⇧X`, icon: <Strikethrough /> },
    { kind: "code", label: "Inline code", keys: `${mod}E`, icon: <Code /> },
    { kind: "block", label: "Code block", keys: `${mod}⇧C`, icon: <SquareCode /> },
  ];

  return (
    <form ref={form} onSubmit={submit} className="relative flex items-end gap-2">
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

      <div className="min-w-0 flex-1 rounded-xl bg-ink-950/60 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-primary">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex items-center gap-0.5 border-b border-line px-1.5 py-1"
        >
          {tools.map((t) => (
            <button
              key={t.kind}
              type="button"
              aria-label={`${t.label} (${t.keys})`}
              title={`${t.label} (${t.keys})`}
              // Keep the textarea's selection while clicking.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(t.kind)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-ink-800 hover:text-fg [&_svg]:size-4"
            >
              {t.icon}
            </button>
          ))}
          <span className="ml-auto hidden pr-1.5 text-[11px] text-fg-subtle sm:block">
            <kbd className="font-sans">Shift+Enter</kbd> for a new line
          </span>
        </div>

        <div className="relative">
          {/* The textarea's own text is transparent; this mirror behind it draws
              the same text with @mentions coloured, scrolled in step with it. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              ref={mirror}
              className="px-4 py-3 text-[15px] leading-6 break-words whitespace-pre-wrap"
            >
              <HighlightedText text={text} mentionables={mentionables} />
              {"​"}
            </div>
          </div>
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            ref={area}
            id="composer"
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setActive(0);
              setDismissedAt(null);
              if (e.target.value) onTyping();
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onScroll={syncMirror}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls="mention-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={open ? `mention-${suggestions[selected]}` : undefined}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder={disabled ? "Reconnecting…" : "Message… (type @ to mention someone)"}
            autoComplete="off"
            className="relative block w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 break-words text-transparent caret-fg [scrollbar-width:none] placeholder:text-fg-subtle selection:bg-primary/30 selection:text-fg focus:outline-none"
          />
        </div>
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
      // Keep focus in the textarea so typing continues.
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

const CODE = /```[\s\S]*?(?:```|$)|`[^`\n]*`/g;

/**
 * The composer text with mentions of people in the room in cyan (so you see
 * who'll be notified) and code in a softer grey. Only colours
 * change: anything that altered widths would knock the mirror out of line.
 */
function HighlightedText({ text, mentionables }: { text: string; mentionables: string[] }) {
  const known = new Set(mentionables.map((m) => m.toLowerCase()));
  const pieces: ReactNode[] = [];
  let last = 0;
  const plain = (s: string, key: string) =>
    splitMentions(s).map((part, i) =>
      part.mention && known.has(part.mention) ? (
        <span key={`${key}-${i}`} className="text-primary">
          {part.text}
        </span>
      ) : (
        <span key={`${key}-${i}`} className="text-fg">
          {part.text}
        </span>
      ),
    );
  for (const m of text.matchAll(CODE)) {
    pieces.push(...plain(text.slice(last, m.index), `t${last}`));
    pieces.push(
      <span key={`c${m.index}`} className="text-ink-200">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  pieces.push(...plain(text.slice(last), `t${last}`));
  return pieces;
}
