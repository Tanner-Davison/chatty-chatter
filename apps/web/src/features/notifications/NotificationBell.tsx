import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AtSign, Bell, CheckCheck } from "lucide-react";
import { Button, IconButton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useLiveNotifications, useMarkRead, useNotifications } from "./api";
import { NotificationItem } from "./NotificationItem";

const DROPDOWN_LIMIT = 4;

export function NotificationBell() {
  useLiveNotifications();
  const { data } = useNotifications();
  const markRead = useMarkRead();
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
            <>
              <ol className="flex flex-col gap-0.5 p-1">
                {data.notifications.slice(0, DROPDOWN_LIMIT).map((n) => (
                  <NotificationItem key={n._id} notification={n} onOpen={() => setOpen(false)} />
                ))}
              </ol>
              {data.total > DROPDOWN_LIMIT && (
                <Link
                  to="/notifications"
                  onClick={() => setOpen(false)}
                  className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-ink-700"
                >
                  View all ({data.total})
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
