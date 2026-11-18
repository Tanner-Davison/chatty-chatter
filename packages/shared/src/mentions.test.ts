import { describe, expect, it } from "vitest";
import { extractMentions, messagePreview, splitMentions } from "./mentions";

describe("extractMentions", () => {
  it("finds lowercase, deduplicated usernames", () => {
    expect(extractMentions("hey @Ben and @cara, also @ben!")).toEqual(["ben", "cara"]);
  });

  it("supports old email-style usernames and trims trailing punctuation", () => {
    expect(extractMentions("ping @corjoh32@student.ogilvie.k12.mn.us.")).toEqual([
      "corjoh32@student.ogilvie.k12.mn.us",
    ]);
    expect(extractMentions("thanks @ben.")).toEqual(["ben"]);
  });

  it("ignores email addresses and lone @ signs", () => {
    expect(extractMentions("mail me at tanner@example.com @ noon")).toEqual([]);
  });

  it("ignores mentions inside code", () => {
    const text = "hey @ben look:\n```ts\nconst who = '@cara';\n```\nand `@dan` too";
    expect(extractMentions(text)).toEqual(["ben"]);
  });

  it("caps the number of mentions", () => {
    const text = Array.from({ length: 15 }, (_, i) => `@user${i}`).join(" ");
    expect(extractMentions(text)).toHaveLength(10);
  });
});

describe("splitMentions", () => {
  it("splits text around mentions", () => {
    expect(splitMentions("hi @ben, ok")).toEqual([
      { text: "hi " },
      { text: "@ben", mention: "ben" },
      { text: ", ok" },
    ]);
  });
});

describe("messagePreview", () => {
  it("summarizes code blocks and keeps surrounding text on one line", () => {
    expect(messagePreview("```cpp\nstd::cout << 1;\n```")).toBe("💻 Code");
    expect(messagePreview("here's the fix:\n```ts\nconst a = 1;\n```\nthoughts?")).toBe(
      "here's the fix: 💻 Code thoughts?",
    );
    expect(messagePreview("```unclosed\ncode")).toBe("💻 Code");
  });

  it("leaves inline code and plain text alone, and handles photos", () => {
    expect(messagePreview("run `npm test`\nnow")).toBe("run `npm test` now");
    expect(messagePreview("", true)).toBe("📷 Photo");
    expect(messagePreview("caption", true)).toBe("caption");
  });
});
