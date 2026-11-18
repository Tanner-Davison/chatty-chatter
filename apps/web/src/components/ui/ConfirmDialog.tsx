import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  /** Destructive actions get the danger button. */
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A small modal asking the user to confirm an action. Escape or Cancel backs out. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "danger",
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
      aria-label={title}
      onClose={onCancel}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-surface-overlay p-0 text-fg shadow-panel ring-1 ring-line-strong backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm open:animate-fade-up"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-lg font-semibold">{title}</h2>
            {children && <div className="text-sm text-fg-muted">{children}</div>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} autoFocus>
              Cancel
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
