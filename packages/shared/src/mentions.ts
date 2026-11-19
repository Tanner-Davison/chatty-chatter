// @mentions. Usernames are lowercase letters, numbers, dots, dashes and
// underscores; some older accounts are email addresses, so one "@domain" part
// is allowed too (e.g. @corjoh32@student.ogilvie.k12.mn.us).

/** Matches a mention: "@" not preceded by a word character, then a username. */
export const MENTION_PATTERN = /(?<![\w@.])@([a-z0-9_.-]+(?:@[a-z0-9-]+(?:\.[a-z0-9-]+)+)?)/gi;

export const MAX_MENTIONS = 10;

/**
 * The message with code blocks (```...```) and inline code (`...`) blanked
 * out, so an @name inside shared code doesn't notify anyone.
 */
export function stripCode(text: string): string {
  return text.replace(/```[\s\S]*?(```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
}

/** Usernames mentioned in a message, lowercased, deduplicated, trailing dots trimmed. */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of stripCode(text).matchAll(MENTION_PATTERN)) {
    const username = match[1]!.toLowerCase().replace(/[.-]+$/, "");
    if (username) found.add(username);
    if (found.size >= MAX_MENTIONS) break;
  }
  return [...found];
}

/** Splits text into plain parts and mention parts, for highlighting. */
export function splitMentions(text: string): { text: string; mention?: string }[] {
  const parts: { text: string; mention?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const raw = match[1]!.replace(/[.-]+$/, "");
    const end = match.index + 1 + raw.length;
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: text.slice(match.index, end), mention: raw.toLowerCase() });
    last = end;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/**
 * A one-line summary of a message for tiles, cards and notifications: code
 * blocks become "💻 Code", newlines collapse, and photo-only messages read
 * "📷 Photo" (GIF-only ones "🎞️ GIF").
 */
export function messagePreview(text: string, hasPhotos = false, hasGif = false): string {
  const summary = text
    .replace(/```[\s\S]*?(```|$)/g, " 💻 Code ")
    .replace(/\s+/g, " ")
    .trim();
  return summary || (hasPhotos ? "📷 Photo" : hasGif ? "🎞️ GIF" : "");
}
