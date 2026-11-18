import { cn } from "../../lib/cn";

/** The original script wordmark, with a soft cyan glow. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-logo text-2xl leading-none text-fg [text-shadow:0_0_18px_rgb(34_211_238/0.35)]",
        className,
      )}
    >
      Chatty Chatter
    </span>
  );
}
