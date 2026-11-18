/** The "@partial" being typed at the caret, if any. */
export function findMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|\s)@([\w.@-]*)$/);
  if (!match) return null;
  return { query: match[1]!.toLowerCase(), start: caret - match[1]!.length - 1 };
}

/** Usernames matching the query: prefix matches first, then anywhere, then alphabetical. */
export function rankMentions(candidates: Iterable<string>, query: string, limit = 6): string[] {
  const scored: [string, number][] = [];
  for (const name of new Set(candidates)) {
    const lower = name.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) continue;
    scored.push([name, index === 0 ? 0 : 1]);
  }
  return scored
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/** Replaces the "@partial" at `start` with the full mention plus a space. */
export function insertMention(text: string, start: number, caret: number, username: string) {
  const next = `${text.slice(0, start)}@${username} ${text.slice(caret)}`;
  return { text: next, caret: start + username.length + 2 };
}
