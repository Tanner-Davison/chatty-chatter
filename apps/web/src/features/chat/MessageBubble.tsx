import { Link } from "react-router";
import { AlertCircle, Trash2 } from "lucide-react";
import { Avatar } from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatMessageTime } from "../../lib/format";
import { firstLink } from "../../lib/markup";
import { useUserProfile } from "../profile/api";
import type { ChatEntry } from "./chatReducer";
import { messageAnchor } from "./anchors";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { MessageContent } from "./MessageContent";
import { PhotoGrid } from "./PhotoGrid";

interface MessageBubbleProps {
  message: ChatEntry;
  isOwn: boolean;
  /** First message in a run from the same sender: shows avatar and name. */
  startsGroup: boolean;
  me: string;
  /** Bubble classes from the hub's colour settings. */
  bubbleClass: string;
  /** Colour for @names in your own messages. */
  ownMentionClass: string;
  onRemovePreview: (messageId: string) => void;
  /** Asks to delete this message; only passed for your own sent or failed messages. */
  onDelete?: (() => void) | undefined;
}

export function MessageBubble({
  message,
  isOwn,
  startsGroup,
  me,
  bubbleClass,
  ownMentionClass,
  onRemovePreview,
  onDelete,
}: MessageBubbleProps) {
  const { data: sender } = useUserProfile(startsGroup ? message.sentBy : undefined);
  // Old messages stored the sender's photo on the message itself.
  const avatar = sender?.profilePic?.url ?? message.imageUrl;
  const mentionsMe = !isOwn && Boolean(message.mentions?.includes(me));
  const firstUrl =
    message.status === "sent" && !message.linkPreviewHidden
      ? firstLink(message.message)
      : undefined;

  return (
    <li
      id={messageAnchor(message.key)}
      className={cn(
        "group/msg -mx-3 flex scroll-mt-24 animate-fade-up gap-3 px-3 py-0.5 sm:-mx-6 sm:px-6",
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
      <div className={cn("flex max-w-[75%] min-w-0 flex-col gap-1", isOwn && "items-end")}>
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
        <div
          className={cn("flex max-w-full min-w-0 items-start gap-1.5", isOwn && "flex-row-reverse")}
        >
          <div
            className={cn(
              "flex max-w-full min-w-0 flex-col gap-1.5",
              isOwn && "items-end",
              message.status === "pending" && "opacity-60",
            )}
          >
            {message.message && (
              <div
                className={cn(
                  "flex max-w-full min-w-0 flex-col gap-1 rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                  isOwn ? "rounded-tr-md" : "rounded-tl-md",
                  bubbleClass,
                  // Like Slack: messages that mention you stand out.
                  mentionsMe && "ring-2 ring-warning/70",
                  message.status === "failed" &&
                    "bg-none bg-danger-soft text-danger ring-1 ring-danger/50 shadow-none",
                )}
              >
                <MessageContent
                  text={message.message}
                  isOwn={isOwn}
                  me={me}
                  ownMentionClass={ownMentionClass}
                />
              </div>
            )}
            {message.attachments && message.attachments.length > 0 && (
              <PhotoGrid photos={message.attachments} alignEnd={isOwn} />
            )}
            {message.gif && (
              <img
                src={message.gif.url}
                // Reserve the GIF's shape so the chat doesn't jump while it loads.
                width={message.gif.width}
                height={message.gif.height}
                alt={message.gif.title || "GIF"}
                title={message.gif.title}
                loading="lazy"
                className="block h-auto max-h-60 w-auto max-w-full rounded-xl bg-surface-raised ring-1 ring-line"
              />
            )}
          </div>
          {onDelete && (
            // Slack-style hover toolbar beside the bubble; also shows on keyboard focus.
            <div className="flex shrink-0 self-center rounded-lg bg-surface-overlay p-0.5 opacity-0 shadow-panel ring-1 ring-line-strong transition group-hover/msg:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete message"
                title="Delete message"
                className="flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}
        </div>
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
