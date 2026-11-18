import { useState } from "react";
import type { Attachment } from "@chatty/shared";
import { Lightbox } from "../../components/ui";
import { cn } from "../../lib/cn";
import { imageAt } from "../../lib/images";

/** A message's photos: one shows large, several tile two across. Click to view full size. */
export function PhotoGrid({ photos, alignEnd }: { photos: Attachment[]; alignEnd: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const single = photos.length === 1;

  return (
    <>
      <div
        className={cn(
          "grid gap-1.5",
          single ? "grid-cols-1" : "grid-cols-2",
          alignEnd && "justify-items-end",
        )}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.cloudinary_id}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
            className="cursor-zoom-in overflow-hidden rounded-xl bg-surface-raised ring-1 ring-line transition hover:ring-line-strong"
          >
            <img
              src={imageAt(photo.url, single ? 720 : 400)}
              // Reserve the photo's shape so the chat doesn't jump while it loads.
              width={photo.width}
              height={photo.height}
              alt=""
              loading="lazy"
              className={cn(
                "block object-cover",
                single
                  ? "max-h-80 w-auto max-w-full sm:max-h-96"
                  : "aspect-square size-36 sm:size-44",
              )}
            />
          </button>
        ))}
      </div>
      <Lightbox images={photos.map((p) => imageAt(p.url, 2000))} index={open} onChange={setOpen} />
    </>
  );
}
