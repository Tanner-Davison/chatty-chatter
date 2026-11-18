import { useState } from "react";
import { useParams } from "react-router";
import { Briefcase, GraduationCap, Pencil, UserMinus, UserPlus, Users } from "lucide-react";
import type { User } from "@chatty/shared";
import { Avatar, Button, LoadingBlock, Panel, PanelHeader } from "../../components/ui";
import { isStatus } from "../../lib/api";
import { useCurrentUser } from "../auth/api";
import { useFriendship, useSetFriend, useUserProfile } from "./api";
import { EditProfileForm } from "./EditProfileForm";

export function ProfilePage() {
  const { username = "" } = useParams();
  const me = useCurrentUser();
  const isMe = username === me.username;
  const { data: user, isPending, error } = useUserProfile(username);
  const [editing, setEditing] = useState(false);

  if (isPending) return <LoadingBlock label="Loading profile" />;
  if (!user) {
    return (
      <p className="mt-10 text-center text-fg-muted">
        {isStatus(error, 404)
          ? `There's no user called @${username}.`
          : "Couldn't load this profile."}
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Panel className="relative overflow-hidden p-6 sm:p-8">
        {/* Cyan-to-violet wash behind the photo, echoing the old teal card. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/25 via-primary/10 to-private/25"
        />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
          <Avatar
            src={user.profilePic?.url}
            name={user.username}
            size="xl"
            ring="primary"
            className="size-32 sm:size-36"
          />
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold tracking-tight uppercase">
              @{user.username}
            </h1>
            {user.profession && <p className="text-fg-muted">{user.profession}</p>}
          </div>
          {isMe ? (
            !editing && (
              <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            )
          ) : (
            <FriendButton username={user.username} />
          )}
        </div>
      </Panel>

      {editing ? (
        <Panel className="p-6">
          <PanelHeader title="Edit profile" accent="primary" className="mb-5" />
          <EditProfileForm user={user} onDone={() => setEditing(false)} />
        </Panel>
      ) : (
        <ProfileDetails user={user} isMe={isMe} />
      )}
    </div>
  );
}

function ProfileDetails({ user, isMe }: { user: User; isMe: boolean }) {
  const stats = [
    { label: "Friends", value: String(user.friends.length), icon: <Users /> },
    { label: "Occupation", value: user.profession || "Unknown", icon: <Briefcase /> },
    { label: "Education", value: user.education || "Unknown", icon: <GraduationCap /> },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Panel key={stat.label} className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5">
              {stat.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-fg-subtle uppercase">{stat.label}</p>
              <p className="truncate font-display font-semibold">{stat.value}</p>
            </div>
          </Panel>
        ))}
      </div>
      <Panel className="p-6">
        <PanelHeader title="Bio" accent="primary" />
        <p className="mt-3 leading-relaxed whitespace-pre-wrap text-fg-muted">
          {user.profileBio ||
            (isMe ? "You haven't written a bio yet. Edit your profile to add one." : "No bio yet.")}
        </p>
      </Panel>
    </>
  );
}

function FriendButton({ username }: { username: string }) {
  const { data } = useFriendship(username, true);
  const setFriend = useSetFriend(username);
  if (!data) return null;
  return data.isFriend ? (
    <Button
      variant="danger"
      icon={<UserMinus className="size-4" />}
      loading={setFriend.isPending}
      onClick={() => setFriend.mutate(false)}
    >
      Unfriend
    </Button>
  ) : (
    <Button
      variant="primary"
      icon={<UserPlus className="size-4" />}
      loading={setFriend.isPending}
      onClick={() => setFriend.mutate(true)}
    >
      Add friend
    </Button>
  );
}
