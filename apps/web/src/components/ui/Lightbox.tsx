import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "./Button";

interface LightboxProps {
  /** Full-size image URLs. */
  images: string[];
  /** Which image is open, or null when closed. */
  index: number | null;
  onChange: (index: number | null) => void;
}

/** Full-screen photo viewer. Arrow keys move between photos; Escape or the backdrop closes. */
export function Lightbox({ images, index, onChange }: LightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const step = (by: number) =>
    index !== null && onChange((index + by + images.length) % images.length);
  const many = images.length > 1;

  return (
    <dialog
      ref={ref}
      aria-label="Photo viewer"
      onClose={() => onChange(null)}
      onClick={(e) => e.target === e.currentTarget && onChange(null)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-ink-950/90 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div
          className="flex h-full flex-col"
          onClick={(e) => e.target === e.currentTarget && onChange(null)}
        >
          <div className="flex items-center justify-end gap-1 p-3">
            {many && (
              <span className="mr-auto pl-2 text-sm text-fg-muted tabular-nums">
                {index + 1} / {images.length}
              </span>
            )}
            <a
              href={images[index]}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open original"
              title="Open original"
              className="flex size-10 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-overlay hover:text-fg"
            >
              <ExternalLink className="size-5" />
            </a>
            <IconButton label="Close" onClick={() => onChange(null)}>
              <X />
            </IconButton>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6"
            onClick={(e) => e.target === e.currentTarget && onChange(null)}
          >
            <img
              src={images[index]}
              alt=""
              className="max-h-full max-w-full animate-fade-up rounded-xl object-contain shadow-panel"
            />
            {many &&
              ([-1, 1] as const).map((by) => (
                <IconButton
                  key={by}
                  label={by < 0 ? "Previous photo" : "Next photo"}
                  onClick={() => step(by)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 bg-surface-overlay/80 text-fg",
                    by < 0 ? "left-4" : "right-4",
                  )}
                >
                  {by < 0 ? <ChevronLeft /> : <ChevronRight />}
                </IconButton>
              ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
