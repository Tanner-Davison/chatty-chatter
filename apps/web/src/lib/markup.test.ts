import { describe, expect, it } from "vitest";
import { firstLink, parseBlocks, parseInline } from "./markup";

describe("parseBlocks", () => {
  it("splits text and fenced code, reading the language", () => {
    expect(parseBlocks("look:\n```ts\nconst a = 1;\n```\nnice")).toEqual([
      { type: "text", text: "look:" },
      { type: "code", lang: "ts", code: "const a = 1;" },
      { type: "text", text: "nice" },
    ]);
  });

  it("keeps one-line fences as code without a language", () => {
    expect(parseBlocks("```npm run dev```")).toEqual([{ type: "code", code: "npm run dev" }]);
  });

  it("treats an unclosed fence as code to the end and keeps indentation", () => {
    expect(parseBlocks("```py\ndef f():\n    return 1")).toEqual([
      { type: "code", lang: "py", code: "def f():\n    return 1" },
    ]);
  });
});

describe("parseInline", () => {
  it("formats bold, italic, strike and inline code", () => {
    expect(parseInline("a *b* _c_ ~d~ `e`")).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", children: [{ kind: "text", text: "b" }] },
      { kind: "text", text: " " },
      { kind: "italic", children: [{ kind: "text", text: "c" }] },
      { kind: "text", text: " " },
      { kind: "strike", children: [{ kind: "text", text: "d" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "e" },
    ]);
  });

  it("nests emphasis", () => {
    expect(parseInline("*bold _both_*")).toEqual([
      {
        kind: "bold",
        children: [
          { kind: "text", text: "bold " },
          { kind: "italic", children: [{ kind: "text", text: "both" }] },
        ],
      },
    ]);
  });

  it("leaves markers inside words, URLs, usernames and code alone", () => {
    expect(parseInline("snake_case_name")).toEqual([{ kind: "text", text: "snake_case_name" }]);
    expect(parseInline("see https://ex.com/a_b_c")).toEqual([
      { kind: "text", text: "see " },
      { kind: "link", href: "https://ex.com/a_b_c" },
    ]);
    expect(parseInline("hi @some_user_name")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", text: "@some_user_name", username: "some_user_name" },
    ]);
    expect(parseInline("`*not bold*`")).toEqual([{ kind: "code", text: "*not bold*" }]);
    expect(parseInline("2 * 3 * 4")).toEqual([{ kind: "text", text: "2 * 3 * 4" }]);
  });

  it("drops trailing punctuation from links", () => {
    expect(parseInline("go to https://ex.com.")).toEqual([
      { kind: "text", text: "go to " },
      { kind: "link", href: "https://ex.com" },
      { kind: "text", text: "." },
    ]);
  });
});

describe("firstLink", () => {
  it("ignores links inside code", () => {
    expect(firstLink("```\nhttps://in.code\n``` then https://real.one")).toBe("https://real.one");
    expect(firstLink("`https://inline.code`")).toBeUndefined();
  });
});
