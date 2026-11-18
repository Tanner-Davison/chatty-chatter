import type { ReceivedColor, SentColor } from "@chatty/shared";

// Full class strings (not built from parts) so Tailwind sees every one.
// Bright sent colours use dark text; deep received colours use light text.

// `mention` colours @names in your own messages so they stand out from the text.
export const SENT_BUBBLES: Record<SentColor, { label: string; bubble: string; mention: string }> = {
  cyan: {
    label: "Cyan",
    bubble: "bg-gradient-to-br from-primary to-primary-strong text-primary-fg shadow-glow-primary",
    mention: "text-blue-900",
  },
  sky: {
    label: "Sky",
    bubble: "bg-gradient-to-br from-sky-400 to-sky-500 text-sky-950",
    mention: "text-indigo-900",
  },
  indigo: {
    label: "Indigo",
    bubble: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white",
    mention: "text-cyan-200",
  },
  violet: {
    label: "Violet",
    bubble: "bg-gradient-to-br from-violet-500 to-violet-600 text-white",
    mention: "text-cyan-200",
  },
  fuchsia: {
    label: "Fuchsia",
    bubble: "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white",
    mention: "text-yellow-200",
  },
  rose: {
    label: "Rose",
    bubble: "bg-gradient-to-br from-rose-500 to-rose-600 text-white",
    mention: "text-yellow-200",
  },
  orange: {
    label: "Orange",
    bubble: "bg-gradient-to-br from-orange-400 to-orange-500 text-orange-950",
    mention: "text-red-950",
  },
  amber: {
    label: "Amber",
    bubble: "bg-gradient-to-br from-amber-300 to-amber-400 text-amber-950",
    mention: "text-orange-800",
  },
  lime: {
    label: "Lime",
    bubble: "bg-gradient-to-br from-lime-300 to-lime-400 text-lime-950",
    mention: "text-emerald-800",
  },
  emerald: {
    label: "Emerald",
    bubble: "bg-gradient-to-br from-emerald-400 to-emerald-500 text-emerald-950",
    mention: "text-blue-950",
  },
};

export const RECEIVED_BUBBLES: Record<ReceivedColor, { label: string; bubble: string }> = {
  graphite: { label: "Graphite", bubble: "bg-surface-overlay text-fg ring-1 ring-line-strong" },
  slate: { label: "Slate", bubble: "bg-slate-700 text-slate-50 ring-1 ring-slate-500/50" },
  navy: { label: "Navy", bubble: "bg-blue-950 text-blue-50 ring-1 ring-blue-700/60" },
  plum: { label: "Plum", bubble: "bg-purple-950 text-purple-50 ring-1 ring-purple-700/60" },
  wine: { label: "Wine", bubble: "bg-rose-950 text-rose-50 ring-1 ring-rose-800/60" },
  rust: { label: "Rust", bubble: "bg-orange-950 text-orange-50 ring-1 ring-orange-800/60" },
  olive: { label: "Olive", bubble: "bg-lime-950 text-lime-50 ring-1 ring-lime-800/60" },
  forest: { label: "Forest", bubble: "bg-emerald-950 text-emerald-50 ring-1 ring-emerald-800/60" },
  teal: { label: "Teal", bubble: "bg-teal-900 text-teal-50 ring-1 ring-teal-700/60" },
  ocean: { label: "Ocean", bubble: "bg-cyan-950 text-cyan-50 ring-1 ring-cyan-800/60" },
};

export const DEFAULT_SENT: SentColor = "cyan";
export const DEFAULT_RECEIVED: ReceivedColor = "graphite";
