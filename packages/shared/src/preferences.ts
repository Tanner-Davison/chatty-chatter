// Per-hub chat colours a user can pick. The ids are stored on the account; the
// web app maps each id to its actual colours.

export const SENT_COLORS = [
  "cyan",
  "sky",
  "indigo",
  "violet",
  "fuchsia",
  "rose",
  "orange",
  "amber",
  "lime",
  "emerald",
] as const;
export type SentColor = (typeof SENT_COLORS)[number];

export const RECEIVED_COLORS = [
  "graphite",
  "slate",
  "navy",
  "plum",
  "wine",
  "rust",
  "olive",
  "forest",
  "teal",
  "ocean",
] as const;
export type ReceivedColor = (typeof RECEIVED_COLORS)[number];

export interface RoomPreferences {
  sentColor?: SentColor;
  receivedColor?: ReceivedColor;
}
