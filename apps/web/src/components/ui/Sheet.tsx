import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "./Button";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
  /** Pinned below the scrolling body, e.g. the main actions. */
  footer?: ReactNode;
  className?: string;
}

/**
 * A panel that slides in from the right (bottom on phones). Built on <dialog>,
 * so focus stays inside and Escape closes it; clicking the backdrop closes too.
 */
export function Sheet({ open, onClose, label, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        "m-0 mt-auto max-h-[85dvh] w-full max-w-none bg-transparent p-0 text-fg backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm",
        "sm:mt-0 sm:ml-auto sm:h-dvh sm:max-h-none sm:w-[28rem]",
        "open:animate-fade-up",
      )}
    >
      <div className="relative flex h-full max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-surface ring-1 ring-line-strong sm:max-h-none sm:rounded-none sm:rounded-l-3xl">
        <IconButton label="Close" onClick={onClose} className="absolute top-4 right-4 z-10">
          <X />
        </IconButton>
        <div className={cn("flex-1 overflow-y-auto p-6", className)}>{open && children}</div>
        {open && footer && <div className="flex gap-2 border-t border-line p-4">{footer}</div>}
      </div>
    </dialog>
  );
}
