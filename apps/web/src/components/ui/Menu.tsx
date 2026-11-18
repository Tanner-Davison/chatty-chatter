import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
}

interface MenuProps {
  /** Renders the trigger; spread `props` onto a button. */
  trigger: (props: {
    onClick: (e: React.MouseEvent) => void;
    "aria-expanded": boolean;
    "aria-controls": string;
    "aria-haspopup": "menu";
  }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
}

/** A small dropdown menu that closes on outside click, Escape or selection. */
export function Menu({ trigger, items, align = "end" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": "menu",
      })}
      {open && (
        <ul
          id={id}
          role="menu"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-44 animate-fade-up overflow-hidden rounded-xl bg-surface-overlay p-1 shadow-panel ring-1 ring-line-strong",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm [&_svg]:size-4",
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger-soft"
                    : "text-fg-muted hover:bg-ink-700 hover:text-fg",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
