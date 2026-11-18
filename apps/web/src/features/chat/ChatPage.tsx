import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, BellMinus, BellPlus, Crown, Lock, Plus } from "lucide-react";
import type { Room } from "@chatty/shared";
import { Badge, Button, ConfirmDialog, LoadingBlock, Panel, StatusDot } from "../../components/ui";
import { useCurrentUser } from "../auth/currentUser";
import { useJoinRoom, useLeaveRoom, useMyRooms, useRoom } from "../rooms/api";
import { ChatSettings } from "./ChatSettings";
import { Composer } from "./Composer";
import { messageAnchor } from "./anchors";
import type { ChatEntry } from "./chatReducer";
import { MentionNavigator } from "./MentionNavigator";
import { MessageBubble } from "./MessageBubble";
import { PrivateRoomGate } from "./PrivateRoomGate";
import { TypingIndicator } from "./TypingIndicator";
import { useRoomColors } from "./roomColors";
import { useChatRoom } from "./useChatRoom";

/**
 * Scrolls a message to the centre and marks it with a quiet "you were sent
 * here" cue: a faint amber row tint (the colour of mentions of you) and a thin
 * left bar that wait for the scroll to land, hold briefly, then fade.
 */
function focusMessage(key: string) {
  const el = document.getElementById(messageAnchor(key));
  if (!el) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  const on = {
    backgroundColor: "rgb(251 191 36 / 0.1)",
    boxShadow: "inset 2px 0 0 rgb(251 191 36 / 0.85)",
  };
  const off = {
    backgroundColor: "rgb(251 191 36 / 0)",
    boxShadow: "inset 2px 0 0 rgb(251 191 36 / 0)",
  };
  el.getAnimations().forEach((a) => a.id === "focus" && a.cancel());
  const animation = el.animate(
    [
      { ...on, offset: 0 },
      { ...on, offset: 0.45 },
      { ...off, offset: 1 },
    ],
    {
      duration: 3200,
      delay: reduceMotion ? 0 : 350,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "backwards",
    },
  );
  animation.id = "focus";
}

export function ChatPage() {
  const roomNumber = Number(useParams().room);
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useRoom(roomNumber);

  if (!Number.isSafeInteger(roomNumber) || roomNumber <= 0) {
    return (
      <Missing title="That isn't a hub number" onBack={() => void navigate("/currentservers")} />
    );
  }
  if (isPending) return <LoadingBlock label="Opening hub" />;
  if (isError)
    return <p className="text-center text-danger">Couldn't open this hub. {error.message}</p>;
  if (data.status === "locked") return <PrivateRoomGate room={data.room} />;
  if (data.status === "missing") {
    return (
      <Missing
        title={`Hub #${roomNumber} doesn't exist yet`}
        onBack={() => void navigate("/currentservers")}
        onCreate={() => void navigate(`/createroom/${roomNumber}`)}
      />
    );
  }
  // Keyed so switching hubs starts with fresh chat state.
  return <ChatRoom key={roomNumber} room={data.room} onReconnect={refetch} />;
}

function ChatRoom({ room, onReconnect }: { room: Room; onReconnect: () => void }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const reload = useCallback(() => onReconnect(), [onReconnect]);
  const {
    messages,
    send,
    notifyTyping,
    hidePreview,
    deleteMessage,
    typingUser,
    connected,
    joinError,
  } = useChatRoom(room.room_number, room.messageHistory, user.username, reload);
  const colors = useRoomColors(room.room_number);
  const [confirmDelete, setConfirmDelete] = useState<ChatEntry | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  // Whether the view should stay pinned to the newest message. Scrolling up to
  // read history unpins it; scrolling back down pins it again.
  const pinned = useRef(true);

  // Follow new messages while pinned, and always after sending one yourself.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (pinned.current || messages.at(-1)?.sentBy === user.username) {
      el.scrollTop = el.scrollHeight;
      pinned.current = true;
    }
  }, [messages, typingUser, user.username]);

  // Link previews and images load after their message, growing the list; stay
  // at the bottom while pinned.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !list.current) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(list.current);
    return () => observer.disconnect();
  }, []);

  // Arriving from a notification (?m=<messageId>): center that message and flash it, once.
  const [params, setParams] = useSearchParams();
  const target = params.get("m");
  const jumpedTo = useRef<string | null>(null);
  const targetLoaded = Boolean(target && messages.some((m) => m.key === target));
  const missedTarget = Boolean(target && messages.length > 0 && !targetLoaded);
  useEffect(() => {
    if (!target || !targetLoaded || jumpedTo.current === target) return;
    jumpedTo.current = target;
    focusMessage(target);
  }, [target, targetLoaded]);
  const clearTarget = () =>
    setParams(
      (p) => {
        p.delete("m");
        return p;
      },
      { replace: true },
    );

  // Anyone in the room or who has posted in it can be @mentioned.
  const mentionables = useMemo(() => {
    const names = new Set([...room.users_in_room, ...messages.map((m) => m.sentBy)]);
    names.delete(user.username);
    names.delete("");
    return [...names];
  }, [room.users_in_room, messages, user.username]);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      {/* Above the message panel: both are frosted (backdrop-blur), which makes
          each its own layer, so the header's popovers need the header itself on top. */}
      <Panel className="relative z-20 flex flex-wrap items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="size-4" />}
          onClick={() => void navigate("/currentservers")}
        >
          <span className="hidden sm:inline">Chat-Hubs</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold capitalize">
            {room.room_name ?? `Hub #${room.room_number}`}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
            #{room.room_number}
            {room.private_room ? (
              <Badge tone="private">
                <Lock /> Private
              </Badge>
            ) : (
              <Badge tone="public">Public</Badge>
            )}
            {room.room_category && <Badge>{room.room_category}</Badge>}
          </p>
        </div>
        <StatusDot online={connected && !joinError} label={joinError ?? undefined} />
        <SubscribeButton room={room} />
        <ChatSettings roomNumber={room.room_number} />
      </Panel>

      <Panel className="relative min-h-0 flex-1">
        <MentionNavigator
          room={room.room_number}
          messages={messages}
          me={user.username}
          onJump={(key) => {
            pinned.current = false;
            focusMessage(key);
          }}
        />
        {missedTarget && (
          <p
            role="status"
            className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2 rounded-xl bg-surface-overlay px-4 py-2 text-sm text-fg-muted ring-1 ring-line-strong"
          >
            That message is too far back to show here.
            <button
              type="button"
              onClick={clearTarget}
              className="cursor-pointer text-primary hover:underline"
            >
              Dismiss
            </button>
          </p>
        )}
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="h-full overflow-y-auto px-3 pb-4 sm:px-6"
        >
          <ol ref={list} aria-label="Messages">
            {messages.length === 0 && (
              <li className="py-16 text-center text-sm text-fg-subtle">No messages yet. Say hi!</li>
            )}
            {messages.map((message, i) => (
              <MessageBubble
                key={message.key}
                message={message}
                isOwn={message.sentBy === user.username}
                startsGroup={messages[i - 1]?.sentBy !== message.sentBy}
                me={user.username}
                bubbleClass={
                  message.sentBy === user.username ? colors.sentClass : colors.receivedClass
                }
                ownMentionClass={colors.sentMentionClass}
                onRemovePreview={hidePreview}
                onDelete={
                  message.sentBy === user.username && message.status !== "pending"
                    ? () => setConfirmDelete(message)
                    : undefined
                }
              />
            ))}
          </ol>
        </div>
      </Panel>

      <div className="flex flex-col gap-1">
        <TypingIndicator username={typingUser} />
        <Composer
          onSend={send}
          onTyping={notifyTyping}
          mentionables={mentionables}
          disabled={!connected}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete message?"
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteMessage(confirmDelete);
          setConfirmDelete(null);
        }}
      >
        This removes it for everyone in the hub. You can't undo this.
      </ConfirmDialog>
    </div>
  );
}

function SubscribeButton({ room }: { room: Room }) {
  const user = useCurrentUser();
  const mine = useMyRooms();
  const join = useJoinRoom();
  const leave = useLeaveRoom();

  if (room.created_by === user.username) {
    return (
      <Badge tone="primary">
        <Crown /> Your hub
      </Badge>
    );
  }
  if (!mine.data) return null;
  const subscribed = mine.data.joined.some((r) => r.room_number === room.room_number);

  return subscribed ? (
    <Button
      size="sm"
      icon={<BellMinus className="size-4" />}
      loading={leave.isPending}
      onClick={() => leave.mutate(room.room_number)}
    >
      Unsubscribe
    </Button>
  ) : (
    <Button
      size="sm"
      variant="primary"
      icon={<BellPlus className="size-4" />}
      loading={join.isPending}
      onClick={() => join.mutate({ roomNumber: room.room_number })}
    >
      Subscribe
    </Button>
  );
}

function Missing({
  title,
  onBack,
  onCreate,
}: {
  title: string;
  onBack: () => void;
  onCreate?: () => void;
}) {
  return (
    <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {onCreate && (
        <p className="text-sm text-fg-muted">The number is free. Create the hub and it's yours.</p>
      )}
      <div className="flex gap-3">
        <Button onClick={onBack} icon={<ArrowLeft className="size-4" />}>
          Back
        </Button>
        {onCreate && (
          <Button variant="primary" onClick={onCreate} icon={<Plus className="size-4" />}>
            Create it
          </Button>
        )}
      </div>
    </Panel>
  );
}
