import { useNavigate } from "react-router";
import { Check, X } from "lucide-react";
import type { Notification } from "@chatty/shared";
import { Avatar, Button } from "../../components/ui";
import { cn } from "../../lib/cn";
import { timeAgo } from "../../lib/format";
import { useFriendAction, useUserProfile } from "../profile/api";
import { useDeleteNotification, useMarkRead } from "./api";

function describe(n: Notification) {
  switch (n.type) {
    case "mention":
      return {
        text: (
          <>
            <span className="text-fg-muted">mentioned you in</span>{" "}
            <span className="font-medium capitalize">{n.roomName ?? `Hub #${n.room}`}</span>
          </>
        ),
        detail: n.preview,
        href: `/chatroom/${n.room}?m=${n.messageId}`,
      };
    case "friend_request":
      return {
        text: <span className="text-fg-muted">sent you a friend request</span>,
        detail:
          n.requestStatus === "accepted"
            ? "You're now friends"
            : n.requestStatus === "declined"
              ? "You declined"
              : undefined,
        href: `/profile/${n.sentBy}`,
      };
    case "friend_accepted":
      return {
        text: <span className="text-fg-muted">accepted your friend request</span>,
        detail: "You're now friends",
        href: `/profile/${n.sentBy}`,
      };
  }
}

/** One notification row: what happened, inline friend-request actions, and delete. */
export function NotificationItem({
  notification: n,
  onOpen,
}: {
  notification: Notification;
  onOpen?: () => void;
}) {
  const navigate = useNavigate();
  const { data: sender } = useUserProfile(n.sentBy);
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const friend = useFriendAction();
  const { text, detail, href } = describe(n);
  const pendingRequest = n.type === "friend_request" && n.requestStatus === "pending";

  const open = () => {
    onOpen?.();
    if (!n.read) markRead.mutate([n._id]);
    void navigate(href);
  };
  const answer = (kind: "accept" | "decline") => {
    if (n.type !== "friend_request") return;
    friend.mutate({ kind, username: n.sentBy, requestId: n.requestId });
  };

  return (
    <li
      className={cn(
        "group/note relative flex flex-col gap-2 rounded-xl p-3 transition hover:bg-ink-700",
        !n.read && "bg-primary-soft/60",
      )}
    >
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 cursor-pointer gap-3 text-left"
      >
        <Avatar src={sender?.profilePic?.url} name={n.sentBy} size="sm" />
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm">
            <span className="font-semibold">@{n.sentBy}</span> {text}
          </p>
          {detail && <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{detail}</p>}
          <p className="mt-1 text-xs text-fg-subtle">{timeAgo(n.createdAt)}</p>
        </div>
      </button>

      {pendingRequest && (
        <div className="flex items-center gap-1.5 pl-11">
          <Button
            size="sm"
            variant="primary"
            icon={<Check className="size-4" />}
            loading={friend.isPending}
            onClick={() => answer("accept")}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={friend.isPending}
            onClick={() => answer("decline")}
          >
            Decline
          </Button>
        </div>
      )}

      {!n.read && !pendingRequest && (
        <span
          aria-label="Unread"
          className="absolute top-4 right-9 size-2 rounded-full bg-primary shadow-glow-primary"
        />
      )}
      <button
        type="button"
        onClick={() => remove.mutate(n._id)}
        aria-label="Delete notification"
        title="Delete notification"
        className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md text-fg-subtle opacity-0 transition group-hover/note:opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
