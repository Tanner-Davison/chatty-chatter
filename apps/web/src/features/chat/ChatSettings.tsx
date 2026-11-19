import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  RECEIVED_COLORS,
  SENT_COLORS,
  type HubCover,
  type RoomSummary,
} from "@chatty/shared";
import { Button, IconButton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { setCachedCover, useMoveCover, useRemoveCover, useUploadCover } from "../rooms/api";
import { RECEIVED_BUBBLES, SENT_BUBBLES } from "./bubbleColors";
import { useRoomColors, useSetRoomColors } from "./roomColors";

interface ChatSettingsProps {
  room: RoomSummary;
  /** Owners also get the hub's cover photo here. */
  isOwner: boolean;
}

/** Gear menu in a hub's header: bubble colours, and the cover photo for the owner. */
export function ChatSettings({ room, isOwner }: ChatSettingsProps) {
  const roomNumber = room.room_number;
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
          className="fixed inset-x-3 top-36 z-40 flex max-h-[calc(100dvh-10rem)] animate-fade-up flex-col gap-4 overflow-y-auto rounded-2xl bg-surface-overlay p-4 shadow-panel ring-1 ring-line-strong sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
        >
          {isOwner && <CoverSettings roomNumber={roomNumber} cover={room.cover_image} />}

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

/** The owner's controls for the picture behind the hub's name. */
function CoverSettings({ roomNumber, cover }: { roomNumber: number; cover: HubCover | undefined }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadCover(roomNumber);
  const remove = useRemoveCover(roomNumber);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = upload.isPending || remove.isPending;
  const error = problem ?? upload.error?.message ?? remove.error?.message;

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setProblem("Use a JPEG, PNG, GIF or WebP image.");
    } else if (file.size > MAX_IMAGE_BYTES) {
      setProblem("Cover photos can be up to 8 MB.");
    } else {
      setProblem(null);
      upload.mutate(file);
    }
  };

  return (
    <section className="flex flex-col gap-3 border-b border-line pb-4">
      <header>
        <h2 className="font-display font-semibold">Cover photo</h2>
        <p className="text-xs text-fg-subtle">
          Shown behind your hub's name here, on Explore and on everyone's hub list.
        </p>
      </header>

      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          icon={<ImagePlus className="size-4" />}
          loading={upload.isPending}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {cover ? "Change" : "Add a cover"}
        </Button>
        {cover && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-4" />}
            disabled={busy}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        )}
      </div>

      {cover && <CoverPosition key={cover.cloudinary_id} roomNumber={roomNumber} cover={cover} />}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/**
 * Slides the cover up or down. The header follows as you drag; the new
 * position is saved when you let go.
 */
function CoverPosition({ roomNumber, cover }: { roomNumber: number; cover: HubCover }) {
  const queryClient = useQueryClient();
  const { mutate: save } = useMoveCover(roomNumber);
  const saved = useRef(cover.focus);

  const commit = () => {
    if (cover.focus === saved.current) return;
    saved.current = cover.focus;
    save(cover.focus);
  };

  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide text-fg-muted uppercase">
      Position
      <input
        type="range"
        min={0}
        max={100}
        value={cover.focus}
        onChange={(e) =>
          setCachedCover(queryClient, roomNumber, { ...cover, focus: Number(e.target.value) })
        }
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full cursor-pointer accent-primary"
      />
      <span className="flex justify-between text-[11px] font-normal tracking-normal normal-case">
        <span>Top</span>
        <span>Bottom</span>
      </span>
    </label>
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
