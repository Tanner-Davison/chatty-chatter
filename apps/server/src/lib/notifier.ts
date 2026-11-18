import type { Notification } from "@chatty/shared";

/** Delivers notifications live to a user's open tabs. */
export interface Notifier {
  send(recipient: string, notification: Notification): void;
  /** Their list changed in a way they should refetch (something removed or updated). */
  changed(recipient: string): void;
}

/** Delivers nothing; for tests and before sockets start. */
export const noNotifier: Notifier = { send: () => {}, changed: () => {} };
