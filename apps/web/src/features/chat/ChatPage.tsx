import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, BellMinus, BellPlus, Crown, ImagePlus, Lock, UserPlus } from "lucide-react";
import type { Room } from "@chatty/shared";
import { Badge, Button, ConfirmDialog, LoadingBlock, Panel, StatusDot } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useCurrentUser } from "../auth/currentUser";
import { COVER_TEXT_SCRIM, HubCoverBackdrop } from "../rooms/HubCoverBackdrop";
import { useJoinRoom, useLeaveRoom, useMyRooms, useRoom } from "../rooms/api";
import { ChatSettings } from "./ChatSettings";
import { InviteSheet } from "./InviteSheet";
import { Composer, type ComposerHandle } from "./Composer";
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
      <Missing title="That hub link isn't right" onBack={() => void navigate("/currentservers")} />
    );
  }
  if (isPending) return <LoadingBlock label="Opening hub" />;
  if (isError)
    return <p className="text-center text-danger">Couldn't open this hub. {error.message}</p>;
  if (data.status === "locked") return <PrivateRoomGate room={data.room} />;
  if (data.status === "missing") {
    return (
      <Missing title="This hub doesn't exist" onBack={() => void navigate("/currentservers")} />
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
  const composer = useRef<ComposerHandle>(null);
  // Counts nested dragenter/dragleave so the overlay doesn't flicker over child elements.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const [confirmDelete, setConfirmDelete] = useState<ChatEntry | null>(null);
  const [inviting, setInviting] = useState(false);
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
    <div
      className="relative flex h-[calc(100dvh-8rem)] flex-col gap-3"
      onDragEnter={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (isFileDrag(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!isFileDrag(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        composer.current?.addFiles([...e.dataTransfer.files]);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex animate-fade-up flex-col items-center justify-center gap-3 rounded-2xl bg-ink-950/80 text-primary ring-2 ring-primary ring-dashed backdrop-blur-sm">
          <ImagePlus className="size-10" />
          <p className="font-display text-lg font-semibold">Drop to share</p>
          <p className="text-sm text-fg-muted">JPEG, PNG, GIF or WebP, up to 4 at a time</p>
        </div>
      )}
      {/* Above the message panel: both are frosted (backdrop-blur), which makes
          each its own layer, so the header's popovers need the header itself on top. */}
      <Panel
        className={cn(
          "relative z-20 flex flex-col gap-3 p-4",
          room.cover_image && "min-h-44 justify-between sm:min-h-56",
        )}
      >
        {/* Behind the header's content, inside the panel's own layer. */}
        <HubCoverBackdrop cover={room.cover_image} width={1600} className="-z-10 rounded-2xl" />
        {/* The hub's name leads, top left; actions sit along the bottom. */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mr-auto flex min-w-0 flex-col gap-1.5",
              room.cover_image && cn(COVER_TEXT_SCRIM, "px-3 py-2"),
            )}
          >
            <h1 className="truncate font-display text-2xl font-bold tracking-tight capitalize sm:text-4xl">
              {room.room_name?.trim() || "Untitled hub"}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-xs">
              {room.private_room ? (
                <Badge tone="private">
                  <Lock /> {room.invite_only ? "Invite only" : "Private"}
                </Badge>
              ) : (
                <Badge tone="public">Public</Badge>
              )}
              {room.room_category && <Badge>{room.room_category}</Badge>}
            </p>
          </div>
          <ChatSettings room={room} isOwner={room.created_by === user.username} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="size-4" />}
            onClick={() => void navigate("/currentservers")}
            className={cn(room.cover_image && "bg-ink-950/60 backdrop-blur-sm")}
          >
            <span className="hidden sm:inline">Chat-Hubs</span>
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <StatusDot online={connected && !joinError} label={joinError ?? undefined} />
            {room.private_room && (
              <Button
                size="sm"
                variant="private"
                icon={<UserPlus className="size-4" />}
                onClick={() => setInviting(true)}
              >
                <span className="hidden sm:inline">Invite</span>
              </Button>
            )}
            <SubscribeButton room={room} />
          </div>
        </div>
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
          ref={composer}
          onSend={send}
          onTyping={notifyTyping}
          mentionables={mentionables}
          disabled={!connected}
        />
      </div>

      {room.private_room && (
        <InviteSheet
          room={room}
          isOwner={room.created_by === user.username}
          open={inviting}
          onClose={() => setInviting(false)}
        />
      )}

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

function Missing({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <Panel className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-fg-muted">It may have been deleted by its owner.</p>
      <Button onClick={onBack} icon={<ArrowLeft className="size-4" />}>
        Back
      </Button>
    </Panel>
  );
}
