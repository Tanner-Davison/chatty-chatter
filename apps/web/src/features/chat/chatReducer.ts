import type { Attachment, ChatMessage } from "@chatty/shared";

export interface ChatEntry extends ChatMessage {
  /** Stable React key: the message id, or a temporary id while sending. */
  key: string;
  status: "sent" | "pending" | "failed";
}

export type ChatAction =
  | { type: "loaded"; messages: ChatMessage[] }
  | { type: "received"; message: ChatMessage }
  | { type: "sending"; tempId: string; sentBy: string; text: string; attachments?: Attachment[] }
  | { type: "sent"; tempId: string; message: ChatMessage }
  | { type: "failed"; tempId: string }
  | { type: "previewHidden"; messageId: string }
  | { type: "deleted"; key: string };

const fromServer = (m: ChatMessage, index: number): ChatEntry => ({
  ...m,
  key: m._id ?? `legacy-${index}-${m.timestamp}`,
  status: "sent",
});

export function chatReducer(state: ChatEntry[], action: ChatAction): ChatEntry[] {
  switch (action.type) {
    case "loaded": {
      // Keep messages still in flight; the server copy replaces everything else.
      const inFlight = state.filter((m) => m.status !== "sent");
      return [...action.messages.map(fromServer), ...inFlight];
    }
    case "received":
      if (action.message._id && state.some((m) => m.key === action.message._id)) return state;
      return [...state, fromServer(action.message, state.length)];
    case "sending":
      return [
        ...state,
        {
          key: action.tempId,
          message: action.text,
          sentBy: action.sentBy,
          ...(action.attachments?.length && { attachments: action.attachments }),
          timestamp: new Date().toISOString(),
          status: "pending",
        },
      ];
    case "sent":
      return state.map((m) => (m.key === action.tempId ? fromServer(action.message, 0) : m));
    case "failed":
      return state.map((m) => (m.key === action.tempId ? { ...m, status: "failed" } : m));
    case "deleted":
      return state.filter((m) => m.key !== action.key);
    case "previewHidden":
      return state.map((m) => (m.key === action.messageId ? { ...m, linkPreviewHidden: true } : m));
  }
}
