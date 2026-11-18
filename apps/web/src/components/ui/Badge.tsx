import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const tones = {
  primary: "bg-primary-soft text-primary ring-primary/30",
  public: "bg-public-soft text-public ring-public/30",
  private: "bg-private-soft text-private ring-private/30",
  danger: "bg-danger-soft text-danger ring-danger/30",
  neutral: "bg-surface-overlay text-fg-muted ring-line-strong",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 [&_svg]:size-3",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A pulsing dot plus label, for live connection state. */
export function StatusDot({ online, label }: { online: boolean; label?: string }) {
  return (
    <Badge tone={online ? "public" : "danger"}>
      <span
        className={cn("size-1.5 rounded-full", online ? "bg-public animate-pulse" : "bg-danger")}
      />
      {label ?? (online ? "Connected" : "Disconnected")}
    </Badge>
  );
}
