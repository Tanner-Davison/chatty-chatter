import { Fragment, lazy, Suspense } from "react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";
import { parseBlocks, parseInline, type Inline } from "../../lib/markup";

const CodeBlock = lazy(() => import("./CodeBlock").then((m) => ({ default: m.CodeBlock })));

interface MessageContentProps {
  text: string;
  isOwn: boolean;
  me: string;
  /** Colour for @names in your own messages, matched to your bubble colour. */
  ownMentionClass?: string;
}

/** A message's formatted text: code blocks, emphasis, links and @mentions. */
export function MessageContent({ text, isOwn, me, ownMentionClass = "" }: MessageContentProps) {
  return parseBlocks(text).map((block, i) =>
    block.type === "code" ? (
      <Suspense
        key={i}
        fallback={
          <pre className="my-1.5 rounded-xl bg-ink-950 p-3 font-mono text-[13px]">{block.code}</pre>
        }
      >
        <CodeBlock code={block.code} lang={block.lang} />
      </Suspense>
    ) : (
      <p key={i} className="break-words whitespace-pre-wrap">
        <InlineContent
          parts={parseInline(block.text)}
          isOwn={isOwn}
          me={me}
          ownMentionClass={ownMentionClass}
        />
      </p>
    ),
  );
}

function InlineContent({
  parts,
  isOwn,
  me,
  ownMentionClass,
}: {
  parts: Inline[];
  isOwn: boolean;
  me: string;
  ownMentionClass: string;
}) {
  return parts.map((part, i) => {
    switch (part.kind) {
      case "text":
        return <Fragment key={i}>{part.text}</Fragment>;
      case "code":
        return (
          <code
            key={i}
            className={cn(
              "rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
              isOwn ? "bg-ink-950/80 text-ink-100" : "bg-ink-950 text-primary ring-1 ring-line",
            )}
          >
            {part.text}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline underline-offset-2"
          >
            {part.href}
          </a>
        );
      case "mention":
        return (
          <Link
            key={i}
            to={`/profile/${part.username}`}
            className={cn(
              // Bold and a different colour; no background chip.
              "font-semibold hover:underline",
              isOwn ? ownMentionClass : part.username === me ? "text-warning" : "text-primary",
            )}
          >
            {part.text}
          </Link>
        );
      case "bold":
        return (
          <strong key={i} className="font-semibold">
            <InlineContent
              parts={part.children}
              isOwn={isOwn}
              me={me}
              ownMentionClass={ownMentionClass}
            />
          </strong>
        );
      case "italic":
        return (
          <em key={i}>
            <InlineContent
              parts={part.children}
              isOwn={isOwn}
              me={me}
              ownMentionClass={ownMentionClass}
            />
          </em>
        );
      case "strike":
        return (
          <s key={i} className="opacity-80">
            <InlineContent
              parts={part.children}
              isOwn={isOwn}
              me={me}
              ownMentionClass={ownMentionClass}
            />
          </s>
        );
    }
  });
}
