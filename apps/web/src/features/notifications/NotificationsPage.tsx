import { useState } from "react";
import { AtSign, CheckCheck, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, LoadingBlock, Panel } from "../../components/ui";
import { useAllNotifications, useDeleteNotification, useMarkRead } from "./api";
import { NotificationItem } from "./NotificationItem";

export function NotificationsPage() {
  const { data, isPending } = useAllNotifications();
  const markRead = useMarkRead();
  const remove = useDeleteNotification();
  const [confirmClear, setConfirmClear] = useState(false);
  const count = data?.notifications.length ?? 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-fg-muted">
            {data
              ? `${data.total} total · ${data.unreadCount} unread`
              : "Mentions and friend requests"}
          </p>
        </div>
        {count > 0 && (
          <div className="flex gap-2">
            {data!.unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<CheckCheck className="size-4" />}
                onClick={() => markRead.mutate(undefined)}
              >
                Mark all read
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => setConfirmClear(true)}
            >
              Clear all
            </Button>
          </div>
        )}
      </header>

      <Panel className="p-2">
        {isPending ? (
          <LoadingBlock label="Loading notifications" />
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-fg-subtle">
            <AtSign className="size-6" />
            You're all caught up.
          </div>
        ) : (
          <ol className="flex flex-col gap-1">
            {data!.notifications.map((n) => (
              <NotificationItem key={n._id} notification={n} />
            ))}
          </ol>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all notifications?"
        confirmLabel="Clear all"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          remove.mutate(undefined);
          setConfirmClear(false);
        }}
      >
        This deletes every notification. Pending friend requests stay on their senders' profiles.
      </ConfirmDialog>
    </div>
  );
}
