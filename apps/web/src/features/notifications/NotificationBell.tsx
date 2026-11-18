import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AtSign, Bell, CheckCheck } from "lucide-react";
import type { Notification } from "@chatty/shared";
import { Avatar, Button, IconButton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { timeAgo } from "../../lib/format";
import { useUserProfile } from "../profile/api";
import { useLiveNotifications, useMarkRead, useNotifications } from "./api";

export function NotificationBell() {
  useLiveNotifications();
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const openNotification = (n: Notification) => {
    setOpen(false);
    if (!n.read) markRead.mutate([n._id]);
    void navigate(`/chatroom/${n.room}?m=${n.messageId}`);
  };

  return (
    <div ref={ref} className="relative">
      <IconButton
        label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn("relative", open && "bg-surface-overlay text-fg")}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-ink-950 shadow-[0_0_10px_rgb(251_113_133/0.6)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </IconButton>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-40 animate-fade-up overflow-hidden rounded-2xl bg-surface-overlay shadow-panel ring-1 ring-line-strong sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display font-semibold">Notifications</h2>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCheck className="size-4" />}
                onClick={() => markRead.mutate(undefined)}
              >
                Mark all read
              </Button>
            )}
          </header>
          {!data || data.notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-fg-subtle">
              <AtSign className="size-6" />
              When someone @mentions you, it shows up here.
            </div>
          ) : (
            <ol className="max-h-[min(28rem,70dvh)] overflow-y-auto p-1">
              {data.notifications.map((n) => (
                <NotificationItem key={n._id} notification={n} onOpen={() => openNotification(n)} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification: n,
  onOpen,
}: {
  notification: Notification;
  onOpen: () => void;
}) {
  const { data: sender } = useUserProfile(n.sentBy);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full cursor-pointer gap-3 rounded-xl p-3 text-left transition hover:bg-ink-700",
          !n.read && "bg-primary-soft/60",
        )}
      >
        <Avatar src={sender?.profilePic?.url} name={n.sentBy} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-semibold">@{n.sentBy}</span>{" "}
            <span className="text-fg-muted">mentioned you in</span>{" "}
            <span className="font-medium capitalize">{n.roomName ?? `Hub #${n.room}`}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{n.preview}</p>
          <p className="mt-1 text-xs text-fg-subtle">{timeAgo(n.createdAt)}</p>
        </div>
        {!n.read && (
          <span
            aria-label="Unread"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary shadow-glow-primary"
          />
        )}
      </button>
    </li>
  );
}
