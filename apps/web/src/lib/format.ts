const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

/**
 * New messages carry ISO timestamps; ones from the old client hold whatever it
 * formatted ("11/26 12:44 am"), which is shown as-is.
 */
export function formatMessageTime(timestamp: string, now = new Date()): string {
  if (!ISO_PATTERN.test(timestamp)) return timestamp;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toDateString() === now.toDateString()
    ? timeFormat.format(date)
    : dateTimeFormat.format(date);
}

/** Splits text into plain parts and http(s) links, for rendering clickable URLs. */
export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /https?:\/\/[^\s]+/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], href: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
  return shortDate.format(new Date(iso));
}

export const handle = (username: string) => `@${username}`;
