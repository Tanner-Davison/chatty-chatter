import { Link } from "react-router";
import { AlertCircle } from "lucide-react";
import { Avatar } from "../../components/ui";
import { cn } from "../../lib/cn";
import { formatMessageTime, linkify } from "../../lib/format";
import { useUserProfile } from "../profile/api";
import type { ChatEntry } from "./chatReducer";

interface MessageBubbleProps {
  message: ChatEntry;
  isOwn: boolean;
  /** First message in a run from the same sender: shows avatar and name. */
  startsGroup: boolean;
}

export function MessageBubble({ message, isOwn, startsGroup }: MessageBubbleProps) {
  const { data: sender } = useUserProfile(startsGroup ? message.sentBy : undefined);
  // Old messages stored the sender's photo on the message itself.
  const avatar = sender?.profilePic?.url ?? message.imageUrl;

  return (
    <li
      className={cn(
        "flex animate-fade-up gap-3",
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
            message.status === "pending" && "opacity-60",
            message.status === "failed" &&
              "bg-none bg-danger-soft text-danger ring-1 ring-danger/50 shadow-none",
          )}
        >
          {linkify(message.message).map((part, i) =>
            part.href ? (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {part.text}
              </a>
            ) : (
              part.text
            ),
          )}
        </p>
        {message.imageUrl && !startsGroup && message.message === "" && (
          <img src={message.imageUrl} alt="" className="max-h-64 rounded-xl" loading="lazy" />
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
