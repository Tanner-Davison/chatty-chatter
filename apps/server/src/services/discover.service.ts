import { Types, type PipelineStage } from "mongoose";
import type { DiscoverQuery, DiscoverRoom, DiscoverSort, RoomPeek } from "@chatty/shared";
import { notFound } from "../lib/http-error";
import type { Presence } from "../lib/presence";
import { RoomModel } from "../models/room.model";
import { UserModel } from "../models/user.model";
import { escapeRegex, joinedRoomNumbers, toMessage } from "./room.service";

const DISCOVER_LIMIT = 60;
const FRIENDS_LIMIT = 12;
const PEEK_MESSAGES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ActivityRecord {
  _id: Types.ObjectId;
  room_number: number;
  room_name?: string | null;
  private_room?: boolean | null;
  created_by: string;
  room_category?: string | null;
  first_message?: string | null;
  users_in_room?: string[] | null;
  messageCount: number;
  recentMessageCount: number;
  memberCount: number;
  last?: { message?: string | null; sentBy?: string | null } | null;
  lastActiveAt: Date;
  createdAt: Date;
}

const SORT_STAGES: Record<DiscoverSort, Record<string, 1 | -1>> = {
  trending: { recentMessageCount: -1, lastActiveAt: -1 },
  active: { lastActiveAt: -1 },
  members: { memberCount: -1, lastActiveAt: -1 },
  newest: { _id: -1 },
};

/**
 * Rooms with activity stats. Every message subdocument has an ObjectId, whose
 * embedded creation time gives real activity dates even for old messages
 * whose `timestamp` strings can't be parsed.
 */
function activityPipeline(
  match: Record<string, unknown>,
  sort: DiscoverSort,
  limit: number,
): PipelineStage[] {
  const since = Types.ObjectId.createFromTime(Math.floor((Date.now() - DAY_MS) / 1000));
  const history = { $ifNull: ["$messageHistory", []] };
  return [
    { $match: match },
    {
      $project: {
        room_number: 1,
        room_name: 1,
        private_room: 1,
        created_by: 1,
        room_category: 1,
        first_message: 1,
        users_in_room: 1,
        messageCount: { $size: history },
        recentMessageCount: {
          $size: { $filter: { input: history, cond: { $gte: ["$$this._id", since] } } },
        },
        memberCount: { $size: { $ifNull: ["$users_in_room", []] } },
        last: { $last: history },
        createdAt: { $toDate: "$_id" },
      },
    },
    { $addFields: { lastActiveAt: { $ifNull: [{ $toDate: "$last._id" }, "$createdAt"] } } },
    { $sort: SORT_STAGES[sort] },
    { $limit: limit },
  ];
}

interface Viewer {
  username: string;
  joined: Set<number>;
}

async function loadViewer(username: string): Promise<Viewer> {
  return { username, joined: new Set(await joinedRoomNumbers(username)) };
}

function toDiscoverRoom(
  r: ActivityRecord,
  viewer: Viewer,
  online: Map<number, number>,
): DiscoverRoom {
  const isPrivate = Boolean(r.private_room);
  const members = r.users_in_room ?? [];
  return {
    _id: r._id.toString(),
    room_number: r.room_number,
    room_name: r.room_name ?? undefined,
    private_room: isPrivate,
    created_by: r.created_by,
    room_category: r.room_category ?? undefined,
    first_message: r.first_message ?? undefined,
    users_in_room: members,
    createdAt: r.createdAt.toISOString(),
    lastActiveAt: r.lastActiveAt.toISOString(),
    messageCount: r.messageCount,
    recentMessageCount: r.recentMessageCount,
    onlineCount: online.get(r.room_number) ?? 0,
    // Private rooms never reveal what's said inside.
    ...(!isPrivate &&
      r.last && { lastMessage: { message: r.last.message ?? "", sentBy: r.last.sentBy ?? "" } }),
    memberPreview: members.slice(-4).reverse(),
    membership:
      r.created_by === viewer.username
        ? "owner"
        : viewer.joined.has(r.room_number)
          ? "joined"
          : "none",
  };
}

async function runDiscovery(
  match: Record<string, unknown>,
  sort: DiscoverSort,
  limit: number,
  viewer: Viewer,
  presence: Presence,
): Promise<DiscoverRoom[]> {
  const records = await RoomModel.aggregate<ActivityRecord>(activityPipeline(match, sort, limit));
  const online = presence.onlineCounts(records.map((r) => r.room_number));
  const rooms = records.map((r) => toDiscoverRoom(r, viewer, online));
  // People in a room right now is the strongest "trending" signal.
  if (sort === "trending") {
    const score = (r: DiscoverRoom) => r.onlineCount * 10 + r.recentMessageCount;
    rooms.sort((a, b) => score(b) - score(a) || b.lastActiveAt.localeCompare(a.lastActiveAt));
  }
  return rooms;
}

export async function discoverRooms(
  username: string,
  query: { category?: DiscoverQuery["category"]; sort: DiscoverSort; q?: string | undefined },
  presence: Presence,
): Promise<DiscoverRoom[]> {
  const match: Record<string, unknown> = {};
  if (query.category) match.room_category = query.category;
  if (query.q) match.room_name = { $regex: escapeRegex(query.q), $options: "i" };
  return runDiscovery(match, query.sort, DISCOVER_LIMIT, await loadViewer(username), presence);
}

/** Rooms the viewer's friends created or joined, excluding the viewer's own. */
export async function friendRooms(username: string, presence: Presence): Promise<DiscoverRoom[]> {
  const me = await UserModel.findOne({ username }, { friends: 1 }).lean();
  const friends = me?.friends ?? [];
  if (friends.length === 0) return [];

  const friendDocs = await UserModel.find(
    { username: { $in: friends } },
    { username: 1, roomsJoined: 1 },
  ).lean();
  const friendsByRoom = new Map<number, Set<string>>();
  for (const friend of friendDocs) {
    for (const ref of friend.roomsJoined ?? []) {
      if (ref.room == null) continue;
      if (!friendsByRoom.has(ref.room)) friendsByRoom.set(ref.room, new Set());
      friendsByRoom.get(ref.room)!.add(friend.username);
    }
  }

  const viewer = await loadViewer(username);
  const rooms = await runDiscovery(
    {
      created_by: { $ne: username },
      $or: [{ created_by: { $in: friends } }, { room_number: { $in: [...friendsByRoom.keys()] } }],
    },
    "active",
    FRIENDS_LIMIT,
    viewer,
    presence,
  );
  return rooms.map((room) => {
    const here = new Set(friendsByRoom.get(room.room_number));
    if (friends.includes(room.created_by)) here.add(room.created_by);
    return { ...room, friendsHere: [...here] };
  });
}

export async function peekRoom(
  username: string,
  roomNumber: number,
  presence: Presence,
): Promise<RoomPeek> {
  const viewer = await loadViewer(username);
  const [room] = await runDiscovery({ room_number: roomNumber }, "active", 1, viewer, presence);
  if (!room) throw notFound("Room not found");

  const locked = room.private_room && room.membership === "none";
  if (locked) return { room, locked, messages: [] };

  const doc = await RoomModel.findOne({ room_number: roomNumber }, { messageHistory: 1 })
    .slice("messageHistory", -PEEK_MESSAGES)
    .lean();
  return { room, locked, messages: (doc?.messageHistory ?? []).map(toMessage) };
}

const SURPRISE_POOL = 10;

/** A random public hub the viewer isn't in, picked from the most active ones. */
export async function surpriseRoom(
  username: string,
  presence: Presence,
): Promise<{ room_number: number } | null> {
  const rooms = await runDiscovery(
    { private_room: { $ne: true } },
    "trending",
    DISCOVER_LIMIT,
    await loadViewer(username),
    presence,
  );
  const fresh = rooms.filter((r) => r.membership === "none");
  const pool = (fresh.length > 0 ? fresh : rooms).slice(0, SURPRISE_POOL);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick ? { room_number: pick.room_number } : null;
}
