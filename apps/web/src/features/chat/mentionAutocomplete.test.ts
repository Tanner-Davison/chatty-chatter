import { describe, expect, it } from "vitest";
import { findMentionQuery, insertMention, rankMentions } from "./mentionAutocomplete";

describe("findMentionQuery", () => {
  it("finds the @word at the caret", () => {
    expect(findMentionQuery("hey @Be", 7)).toEqual({ query: "be", start: 4 });
    expect(findMentionQuery("@", 1)).toEqual({ query: "", start: 0 });
  });

  it("ignores emails and finished words", () => {
    expect(findMentionQuery("mail tanner@ex", 14)).toBeNull();
    expect(findMentionQuery("hey @ben ", 9)).toBeNull();
  });

  it("only looks at text before the caret", () => {
    expect(findMentionQuery("@ben and more", 4)).toEqual({ query: "ben", start: 0 });
  });
});

describe("rankMentions", () => {
  it("puts prefix matches first and dedupes", () => {
    expect(rankMentions(["rob", "ben", "bob", "ben", "abe"], "b")).toEqual([
      "ben",
      "bob",
      "abe",
      "rob",
    ]);
  });

  it("limits results", () => {
    expect(rankMentions(["a1", "a2", "a3"], "a", 2)).toEqual(["a1", "a2"]);
  });
});

describe("insertMention", () => {
  it("swaps the partial for the full mention and moves the caret after it", () => {
    expect(insertMention("hi @be how", 3, 6, "ben")).toEqual({ text: "hi @ben  how", caret: 8 });
  });
});
