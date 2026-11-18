import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("size-5 animate-spin", className)} />;
}

/** A centered spinner with a label for screen readers, for whole sections. */
export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-fg-muted">
      <Spinner />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
