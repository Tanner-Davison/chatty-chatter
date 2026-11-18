import { useState, type FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { MESSAGE_MAX_LENGTH } from "@chatty/shared";
import { Button } from "../../components/ui";

interface ComposerProps {
  onSend: (text: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}

/** Message box. Enter or the Send button sends. */
export function Composer({ onSend, onTyping, disabled }: ComposerProps) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <input
        id="composer"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value) onTyping();
        }}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder={disabled ? "Reconnecting…" : "Message…"}
        autoComplete="off"
        className="h-12 flex-1 rounded-xl bg-ink-950/60 px-4 text-[15px] ring-1 ring-line-strong placeholder:text-fg-subtle focus:ring-2 focus:ring-primary focus:outline-none"
      />
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
