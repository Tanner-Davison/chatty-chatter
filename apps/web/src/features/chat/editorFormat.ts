// Text edits behind the composer's formatting toolbar and shortcuts. Each
// returns the new text and selection so the caller can restore the cursor.

export interface Edit {
  text: string;
  start: number;
  end: number;
}

/** Wraps the selection in a marker (*, _, ~, `), or unwraps it if it's already wrapped. */
export function toggleWrap(text: string, start: number, end: number, marker: string): Edit {
  const n = marker.length;
  const wrapped = text.slice(start - n, start) === marker && text.slice(end, end + n) === marker;
  if (wrapped) {
    return {
      text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n),
      start: start - n,
      end: end - n,
    };
  }
  const next = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
  return { text: next, start: start + n, end: end + n };
}

/** Puts the selection (or an empty block) in a fenced code block on its own lines. */
export function insertCodeBlock(text: string, start: number, end: number): Edit {
  const before = text.slice(0, start);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const after = text.slice(end);
  const trail = after === "" || after.startsWith("\n") ? "" : "\n";
  const open = `${lead}\`\`\`\n`;
  const next = before + open + text.slice(start, end) + "\n```" + trail + after;
  return { text: next, start: start + open.length, end: end + open.length };
}

/** Whether the caret sits inside a ``` block that hasn't been closed yet. */
export function insideOpenFence(text: string, caret: number): boolean {
  return (text.slice(0, caret).match(/```/g)?.length ?? 0) % 2 === 1;
}
