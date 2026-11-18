/** Answers "how many people have these rooms open right now?". */
export interface Presence {
  onlineCounts(rooms: number[]): Map<number, number>;
}

/** Presence for when nothing is tracked (tests, or before sockets start). */
export const noPresence: Presence = { onlineCounts: () => new Map() };
