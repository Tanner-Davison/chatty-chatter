// Slack-style message formatting:
//   ```lang         fenced code block (language optional)
//   `code`          inline code
//   *bold* _italic_ ~strike~   (markers must sit at word boundaries)
// plus links and @mentions. Nothing inside code is formatted.

import { splitMentions } from "@chatty/shared";

export type Block = { type: "text"; text: string } | { type: "code"; code: string; lang?: string };

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string }
  | { kind: "mention"; text: string; username: string }
  | { kind: "bold" | "italic" | "strike"; children: Inline[] };

const FENCE = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g;
const LANG = /^[A-Za-z0-9+#.-]{1,20}$/;

/** Splits a message into text and fenced code blocks. An unclosed fence runs to the end. */
export function parseBlocks(message: string): Block[] {
  const blocks: Block[] = [];
  let last = 0;
  for (const m of message.matchAll(FENCE)) {
    const before = message.slice(last, m.index).replace(/\n$/, "");
    if (before) blocks.push({ type: "text", text: before });
    let [, info = "", code = ""] = m;
    // "```ts\ncode" names a language; "```some code```" on one line doesn't.
    const hasNewline = m[0].slice(3).startsWith(info + "\n");
    if (!(hasNewline && LANG.test(info.trim()))) {
      code = info + (hasNewline ? "\n" : "") + code;
      info = "";
    }
    blocks.push({
      type: "code",
      code: code.replace(/\n$/, ""),
      ...(info.trim() && { lang: info.trim().toLowerCase() }),
    });
    last = m.index + m[0].length;
    if (message[last] === "\n") last++;
  }
  const rest = message.slice(last);
  if (rest) blocks.push({ type: "text", text: rest });
  return blocks;
}

const INLINE_CODE = /`([^`\n]+)`/g;
const URL = /https?:\/\/[^\s<]+[^\s<.,!?:;)'"]/g;
// A marker opens after start/space/punctuation and closes before end/space/punctuation.
const EMPHASIS = /(^|[\s([{"'>])([*_~])(?=\S)([^\n]*?\S)\2(?=$|[\s)\]}.,!?:;"'<])/;
const KIND = { "*": "bold", _: "italic", "~": "strike" } as const;

function splitBy(
  text: string,
  pattern: RegExp,
  make: (m: RegExpMatchArray) => Inline,
  rest: (s: string) => Inline[],
): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(...rest(text.slice(last, m.index)));
    out.push(make(m));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...rest(text.slice(last)));
  return out;
}

function mentionsAndText(text: string): Inline[] {
  return splitMentions(text).map((p) =>
    p.mention
      ? { kind: "mention", text: p.text, username: p.mention }
      : { kind: "text", text: p.text },
  );
}

function emphasis(text: string): Inline[] {
  const m = text.match(EMPHASIS);
  if (!m || m.index === undefined) return mentionsAndText(text);
  const [whole, lead = "", marker, content = ""] = m;
  const start = m.index + lead.length;
  return [
    ...mentionsAndText(text.slice(0, start)),
    { kind: KIND[marker as keyof typeof KIND], children: emphasis(content) },
    ...emphasis(text.slice(m.index + whole.length)),
  ];
}

/** Parses one text block into inline pieces. */
export function parseInline(text: string): Inline[] {
  return splitBy(
    text,
    INLINE_CODE,
    (m) => ({ kind: "code", text: m[1]! }),
    (outside) => splitBy(outside, URL, (m) => ({ kind: "link", href: m[0] }), emphasis),
  );
}

/** The first link outside code, for the link preview. */
export function firstLink(message: string): string | undefined {
  for (const block of parseBlocks(message)) {
    if (block.type !== "text") continue;
    const link = parseInline(block.text).find((p) => p.kind === "link");
    if (link?.kind === "link") return link.href;
  }
  return undefined;
}
