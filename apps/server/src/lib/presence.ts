/** Answers "how many people have these rooms open right now?". */
export interface Presence {
  onlineCounts(rooms: number[]): Map<number, number>;
  /** Whether the user has the app open anywhere. */
  isOnline(username: string): boolean;
}

/** Presence for when nothing is tracked (tests, or before sockets start). */
export const noPresence: Presence = { onlineCounts: () => new Map(), isOnline: () => false };
