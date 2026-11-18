import { Fragment } from "react";
import { Link } from "react-router";
import { AlertCircle } from "lucide-react";
import { splitMentions } from "@chatty/shared";
import { Avatar } from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatMessageTime, linkify } from "../../lib/format";
import { useUserProfile } from "../profile/api";
import type { ChatEntry } from "./chatReducer";
import { messageAnchor } from "./anchors";
import { LinkPreviewCard } from "./LinkPreviewCard";

interface MessageBubbleProps {
  message: ChatEntry;
  isOwn: boolean;
  /** First message in a run from the same sender: shows avatar and name. */
  startsGroup: boolean;
  me: string;
  onRemovePreview: (messageId: string) => void;
}

export function MessageBubble({
  message,
  isOwn,
  startsGroup,
  me,
  onRemovePreview,
}: MessageBubbleProps) {
  const { data: sender } = useUserProfile(startsGroup ? message.sentBy : undefined);
  // Old messages stored the sender's photo on the message itself.
  const avatar = sender?.profilePic?.url ?? message.imageUrl;
  const mentionsMe = !isOwn && Boolean(message.mentions?.includes(me));
  const firstUrl =
    message.status === "sent" && !message.linkPreviewHidden
      ? linkify(message.message).find((p) => p.href)?.href
      : undefined;

  return (
    <li
      id={messageAnchor(message.key)}
      className={cn(
        "-mx-3 flex scroll-mt-24 animate-fade-up gap-3 px-3 py-0.5 sm:-mx-6 sm:px-6",
        isOwn && "flex-row-reverse",
        startsGroup ? "mt-4" : "mt-1",
      )}
    >
      <div className="w-10 shrink-0">
        {startsGroup && (
          <Link to={`/profile/${message.sentBy}`} aria-label={`${message.sentBy}'s profile`}>
            <Avatar src={avatar} name={message.sentBy} ring={isOwn ? "primary" : "none"} />
          </Link>
        )}
      </div>
      <div className={cn("flex max-w-[75%] flex-col gap-1", isOwn && "items-end")}>
        {startsGroup && (
          <p className={cn("flex items-baseline gap-2 text-xs", isOwn && "flex-row-reverse")}>
            <span className="font-display font-semibold tracking-wide text-fg-muted uppercase">
              @{message.sentBy}
            </span>
            <time className="text-fg-subtle" dateTime={message.timestamp}>
              {formatMessageTime(message.timestamp)}
            </time>
          </p>
        )}
        <p
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap",
            isOwn
              ? "rounded-tr-md bg-gradient-to-br from-primary to-primary-strong text-primary-fg shadow-glow-primary"
              : "rounded-tl-md bg-surface-overlay text-fg ring-1 ring-line-strong",
            // Like Slack: messages that mention you stand out.
            mentionsMe && "bg-warning/10 ring-2 ring-warning/50",
            message.status === "pending" && "opacity-60",
            message.status === "failed" &&
              "bg-none bg-danger-soft text-danger ring-1 ring-danger/50 shadow-none",
          )}
        >
          <MessageText text={message.message} isOwn={isOwn} me={me} />
        </p>
        {firstUrl && message._id && (
          <LinkPreviewCard
            url={firstUrl}
            messageId={message._id}
            isOwn={isOwn}
            onRemove={() => onRemovePreview(message._id!)}
          />
        )}
        {message.status === "failed" && (
          <p className="flex items-center gap-1 text-xs text-danger">
            <AlertCircle className="size-3" /> Not sent
          </p>
        )}
      </div>
    </li>
  );
}

/** Message text with clickable links and highlighted @mentions. */
function MessageText({ text, isOwn, me }: { text: string; isOwn: boolean; me: string }) {
  return splitMentions(text).map((part, i) =>
    part.mention ? (
      <Link
        key={i}
        to={`/profile/${part.mention}`}
        className={cn(
          "rounded-md px-1 font-semibold",
          isOwn
            ? "bg-ink-950/85 text-primary hover:bg-ink-950"
            : part.mention === me
              ? "bg-warning/20 text-warning"
              : "bg-primary-soft text-primary hover:bg-primary/20",
        )}
      >
        {part.text}
      </Link>
    ) : (
      <Fragment key={i}>
        {linkify(part.text).map((piece, j) =>
          piece.href ? (
            <a
              key={j}
              href={piece.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {piece.text}
            </a>
          ) : (
            piece.text
          ),
        )}
      </Fragment>
    ),
  );
}
