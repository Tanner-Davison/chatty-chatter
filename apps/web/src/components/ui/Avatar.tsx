import { useState } from "react";
import { cn } from "../../lib/cn";

const sizes = {
  xs: "size-6 text-[10px] rounded-md",
  sm: "size-8 text-xs rounded-lg",
  md: "size-10 text-sm rounded-xl",
  lg: "size-14 text-base rounded-2xl",
  xl: "size-40 text-4xl rounded-[2rem]",
} as const;

interface AvatarProps {
  src?: string | undefined;
  name: string;
  size?: keyof typeof sizes;
  ring?: "primary" | "public" | "private" | "none";
  className?: string;
}

const rings = {
  primary: "ring-2 ring-primary/70",
  public: "ring-2 ring-public/70",
  private: "ring-2 ring-private/70",
  none: "ring-1 ring-line-strong",
} as const;

/** A profile photo, falling back to the user's initial when there's none or it fails to load. */
export function Avatar({ src, name, size = "md", ring = "none", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const base = cn("shrink-0 object-cover", sizes[size], rings[ring], className);

  if (!src || failed) {
    return (
      <span
        aria-label={name}
        className={cn(
          base,
          "inline-flex items-center justify-center bg-surface-overlay font-display font-semibold text-fg-muted uppercase",
        )}
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={base} />
  );
}
