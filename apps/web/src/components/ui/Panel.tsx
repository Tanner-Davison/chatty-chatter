import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

/** The glassy dark container every page section sits in. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-surface/80 shadow-panel ring-1 ring-line backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  /** A small coloured marker before the title, matching the section's role colour. */
  accent?: "primary" | "public" | "private" | "neutral";
  actions?: ReactNode;
  className?: string;
}

const accentDot = {
  primary: "bg-primary shadow-glow-primary",
  public: "bg-public shadow-glow-public",
  private: "bg-private shadow-glow-private",
  neutral: "bg-ink-400",
} as const;

export function PanelHeader({ title, accent = "neutral", actions, className }: PanelHeaderProps) {
  return (
    <header className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight">
        <span aria-hidden className={cn("size-2 rounded-full", accentDot[accent])} />
        {title}
      </h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
