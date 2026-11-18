import { describe, expect, it } from "vitest";
import { insertCodeBlock, insideOpenFence, toggleWrap } from "./editorFormat";

describe("toggleWrap", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(toggleWrap("make this bold", 5, 9, "*")).toEqual({
      text: "make *this* bold",
      start: 6,
      end: 10,
    });
  });

  it("unwraps an already wrapped selection", () => {
    expect(toggleWrap("make *this* bold", 6, 10, "*")).toEqual({
      text: "make this bold",
      start: 5,
      end: 9,
    });
  });

  it("inserts empty markers with the caret between them", () => {
    expect(toggleWrap("hi ", 3, 3, "`")).toEqual({ text: "hi ``", start: 4, end: 4 });
  });
});

describe("insertCodeBlock", () => {
  it("fences the selection on its own lines", () => {
    expect(insertCodeBlock("see: x = 1 ok", 5, 10)).toEqual({
      text: "see: \n```\nx = 1\n```\n ok",
      start: 10,
      end: 15,
    });
  });

  it("inserts an empty block at the start", () => {
    expect(insertCodeBlock("", 0, 0)).toEqual({ text: "```\n\n```", start: 4, end: 4 });
  });
});

describe("insideOpenFence", () => {
  it("knows when the caret is inside an unclosed block", () => {
    expect(insideOpenFence("```ts\nconst a", 13)).toBe(true);
    expect(insideOpenFence("```ts\nx\n``` after", 17)).toBe(false);
    expect(insideOpenFence("no code", 7)).toBe(false);
  });
});
