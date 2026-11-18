import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Settings2 } from "lucide-react";
import { RECEIVED_COLORS, SENT_COLORS } from "@chatty/shared";
import { Button, IconButton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { RECEIVED_BUBBLES, SENT_BUBBLES } from "./bubbleColors";
import { useRoomColors, useSetRoomColors } from "./roomColors";

/** Gear menu in a hub's header for picking this hub's bubble colours. */
export function ChatSettings({ roomNumber }: { roomNumber: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = useRoomColors(roomNumber);
  const save = useSetRoomColors(roomNumber);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton
        label="Hub settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(open && "bg-surface-overlay text-fg")}
      >
        <Settings2 />
      </IconButton>
      {open && (
        <div
          role="dialog"
          aria-label="Hub settings"
          className="fixed inset-x-3 top-36 z-40 flex animate-fade-up flex-col gap-4 rounded-2xl bg-surface-overlay p-4 shadow-panel ring-1 ring-line-strong sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
        >
          <header>
            <h2 className="font-display font-semibold">Chat colours</h2>
            <p className="text-xs text-fg-subtle">Only you see these, and only in this hub.</p>
          </header>

          <div className="flex flex-col gap-1.5 rounded-xl bg-ink-950/60 p-3 text-sm ring-1 ring-line">
            <p
              className={cn(
                "w-fit max-w-[80%] rounded-2xl rounded-tl-md px-3 py-1.5",
                colors.receivedClass,
              )}
            >
              Hey, how's it going?
            </p>
            <p
              className={cn(
                "w-fit max-w-[80%] self-end rounded-2xl rounded-tr-md px-3 py-1.5",
                colors.sentClass,
              )}
            >
              Pretty good!
            </p>
          </div>

          <Swatches
            title="Your messages"
            options={SENT_COLORS.map((id) => ({ id, ...SENT_BUBBLES[id] }))}
            selected={colors.sent}
            onPick={(id) => save.mutate({ sentColor: id as (typeof SENT_COLORS)[number] })}
          />
          <Swatches
            title="Everyone else's"
            options={RECEIVED_COLORS.map((id) => ({ id, ...RECEIVED_BUBBLES[id] }))}
            selected={colors.received}
            onPick={(id) => save.mutate({ receivedColor: id as (typeof RECEIVED_COLORS)[number] })}
          />

          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="size-4" />}
            onClick={() => save.mutate({ sentColor: null, receivedColor: null })}
            className="self-start"
          >
            Reset to default
          </Button>
        </div>
      )}
    </div>
  );
}

function Swatches({
  title,
  options,
  selected,
  onPick,
}: {
  title: string;
  options: { id: string; label: string; bubble: string }[];
  selected: string;
  onPick: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium tracking-wide text-fg-muted uppercase">
        {title}
      </legend>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-5 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected === o.id}
            aria-label={o.label}
            title={o.label}
            onClick={() => onPick(o.id)}
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center rounded-xl text-xs font-semibold transition",
              o.bubble,
              selected === o.id
                ? "ring-2 ring-fg ring-offset-2 ring-offset-surface-overlay"
                : "hover:scale-105",
            )}
          >
            {selected === o.id ? <Check className="size-4" /> : "Aa"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
