import type { HubCover } from "@chatty/shared";
import { cn } from "../../lib/cn";
import { imageAt } from "../../lib/images";

/** A steady hue per category, so hubs without a cover still get their own colour. */
function categoryHue(category: string | undefined): number {
  let hash = 0;
  for (const ch of category ?? "General") hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

interface HubCoverBackdropProps {
  cover: HubCover | undefined;
  category?: string | undefined;
  /** Width to request from Cloudinary. */
  width?: number;
  /** Paint a category gradient when there's no cover; otherwise render nothing. */
  fallback?: boolean;
  className?: string;
}

/**
 * The owner's cover photo behind a hub's name, dimmed so text stays readable.
 * The dimming lifts while a `group` ancestor is hovered.
 */
export function HubCoverBackdrop({
  cover,
  category,
  width = 800,
  fallback = false,
  className,
}: HubCoverBackdropProps) {
  if (!cover && !fallback) return null;
  const hue = categoryHue(category);

  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden", className)}>
      {cover ? (
        <img
          src={imageAt(cover.url, width)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ objectPosition: `50% ${cover.focus}%` }}
          className="size-full object-cover transition duration-500 motion-safe:group-hover:scale-105"
        />
      ) : (
        <div
          className="size-full"
          style={{
            background: `radial-gradient(120% 90% at 85% 0%, oklch(0.42 0.13 ${hue} / 0.9), transparent 60%), linear-gradient(135deg, oklch(0.3 0.08 ${hue}), oklch(0.18 0.04 ${(hue + 40) % 360}))`,
          }}
        />
      )}
      {/* Dims the whole picture; lifts on hover. */}
      <div className="absolute inset-0 bg-ink-950/55 transition duration-300 group-hover:bg-ink-950/15 group-focus-visible:bg-ink-950/15" />
      {/* Keeps the text at the bottom readable even when the picture is bright. */}
      <div className="absolute inset-0 bg-linear-to-t from-ink-950/85 via-ink-950/25 to-transparent" />
    </div>
  );
}
