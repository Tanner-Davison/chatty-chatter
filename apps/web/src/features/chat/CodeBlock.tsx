import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A fenced code block: language label, copy button, and syntax colours that
 * load in the background (plain text shows first).
 */
export function CodeBlock({ code, lang }: { code: string; lang?: string | undefined }) {
  const [highlighted, setHighlighted] = useState<{ html: string; language?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("./highlight").then(({ highlight }) => {
      if (!cancelled) setHighlighted(highlight(code, lang));
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const label = highlighted?.language ?? lang ?? "code";
  return (
    <div className="my-1.5 overflow-hidden rounded-xl bg-ink-950 text-left ring-1 ring-line-strong first:mt-0 last:mb-0">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-fg-subtle">
        <span className="font-mono">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-ink-800 hover:text-fg"
        >
          {copied ? <Check className="size-3.5 text-public" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="hljs max-h-96 overflow-auto p-3 font-mono text-[13px] leading-relaxed text-ink-200">
        {highlighted ? (
          <code dangerouslySetInnerHTML={{ __html: highlighted.html }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
