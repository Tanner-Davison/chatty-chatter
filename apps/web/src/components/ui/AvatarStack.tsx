import { useUserProfile } from "../../features/profile/api";
import { cn } from "../../lib/cn";
import { Avatar } from "./Avatar";

function StackedAvatar({ username }: { username: string }) {
  const { data } = useUserProfile(username);
  return (
    <Avatar
      src={data?.profilePic?.url}
      name={username}
      size="xs"
      className="-ml-1.5 ring-2 ring-surface first:ml-0"
    />
  );
}

/** Overlapping member photos, then "+N" for the rest. */
export function AvatarStack({
  usernames,
  total,
  className,
}: {
  usernames: string[];
  total: number;
  className?: string;
}) {
  const extra = total - usernames.length;
  return (
    <div className={cn("flex items-center", className)}>
      {usernames.map((u) => (
        <StackedAvatar key={u} username={u} />
      ))}
      {extra > 0 && <span className="ml-1.5 text-xs text-fg-subtle">+{extra}</span>}
    </div>
  );
}
