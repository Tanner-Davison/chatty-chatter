import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@chatty/shared";
import { chatReducer, type ChatEntry } from "./chatReducer";

const msg = (id: string, text = id): ChatMessage => ({
  _id: id,
  message: text,
  sentBy: "ben",
  timestamp: "2026-11-18T07:00:00.000Z",
});

describe("chatReducer", () => {
  it("loads history, giving legacy messages without ids a key", () => {
    const state = chatReducer([], {
      type: "loaded",
      messages: [msg("a"), { ...msg("b"), _id: undefined }],
    });
    expect(state.map((m) => m.status)).toEqual(["sent", "sent"]);
    expect(new Set(state.map((m) => m.key)).size).toBe(2);
  });

  it("ignores a message it already has", () => {
    const state = chatReducer([], { type: "loaded", messages: [msg("a")] });
    expect(chatReducer(state, { type: "received", message: msg("a") })).toBe(state);
    expect(chatReducer(state, { type: "received", message: msg("b") })).toHaveLength(2);
  });

  it("shows a sent message immediately, then swaps in the server copy", () => {
    let state: ChatEntry[] = chatReducer([], {
      type: "sending",
      tempId: "t1",
      sentBy: "tanner",
      text: "hi",
    });
    expect(state[0]).toMatchObject({ key: "t1", status: "pending", message: "hi" });

    state = chatReducer(state, {
      type: "sent",
      tempId: "t1",
      message: { ...msg("srv"), sentBy: "tanner", message: "hi" },
    });
    expect(state).toEqual([expect.objectContaining({ key: "srv", status: "sent" })]);
  });

  it("marks a message failed when the server rejects it", () => {
    const state = chatReducer([], { type: "sending", tempId: "t1", sentBy: "tanner", text: "hi" });
    expect(chatReducer(state, { type: "failed", tempId: "t1" })[0]?.status).toBe("failed");
  });

  it("keeps in-flight messages when history reloads", () => {
    const state = chatReducer([], { type: "sending", tempId: "t1", sentBy: "tanner", text: "hi" });
    const reloaded = chatReducer(state, { type: "loaded", messages: [msg("a")] });
    expect(reloaded.map((m) => m.key)).toEqual(["a", "t1"]);
  });
});
