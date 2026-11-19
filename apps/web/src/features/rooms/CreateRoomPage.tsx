import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Check, Globe, KeyRound, Link2, Lock, Shapes, Type } from "lucide-react";
import { createRoomSchema, ROOM_CATEGORIES, type CreateRoomInput } from "@chatty/shared";
import { Button, Field, Input, Panel, PasswordInput, Select } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useCreateRoom } from "./api";

/** How people get into a private hub. */
type PrivateAccess = "invite" | "password";

type Errors = Partial<Record<"name" | "category" | "password" | "_", string>>;

export function CreateRoomPage() {
  const navigate = useNavigate();
  const create = useCreateRoom();
  const [isPrivate, setIsPrivate] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [access, setAccess] = useState<PrivateAccess>("invite");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const needsPassword = isPrivate && access === "password";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    try {
      const draft = {
        name,
        category: category || undefined,
        isPrivate,
        ...(needsPassword && { password }),
      };
      // The schema allows no category (old hubs have none), but new hubs need one.
      const parsed = createRoomSchema.safeParse(draft);
      const next: Errors = category ? {} : { category: "Pick a category" };
      for (const issue of parsed.error?.issues ?? []) {
        next[(issue.path[0] as keyof Errors | undefined) ?? "_"] ??= issue.message;
      }
      if (!parsed.success || Object.keys(next).length > 0) return setErrors(next);
      const room = await create.mutateAsync(parsed.data satisfies CreateRoomInput);
      void navigate(`/chatroom/${room.room_number}`);
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : "Something went wrong" });
    }
  };

  return (
    <Panel
      className={cn(
        "mx-auto max-w-xl p-6 sm:p-8 transition-shadow",
        isPrivate ? "shadow-glow-private" : "shadow-glow-public",
      )}
    >
      <h1 className="font-display text-3xl font-bold tracking-tight">Hub builder</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Start a public hub anyone can join, or a private one for the people you invite.
      </p>

      <div
        role="tablist"
        aria-label="Hub type"
        className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-ink-950/60 p-1 ring-1 ring-line"
      >
        <TypeTab
          active={!isPrivate}
          onClick={() => setIsPrivate(false)}
          icon={<Globe />}
          label="Public"
          tone="public"
        />
        <TypeTab
          active={isPrivate}
          onClick={() => setIsPrivate(true)}
          icon={<Lock />}
          label="Private"
          tone="private"
        />
      </div>

      {isPrivate && (
        <div
          role="radiogroup"
          aria-label="Who can get in"
          className="mt-3 grid animate-fade-up gap-2 sm:grid-cols-2"
        >
          <AccessOption
            selected={access === "invite"}
            onSelect={() => setAccess("invite")}
            icon={<Link2 />}
            title="Invite only"
            description="People join with your invite link or when a member adds them. Hidden from Explore."
          />
          <AccessOption
            selected={access === "password"}
            onSelect={() => setAccess("password")}
            icon={<KeyRound />}
            title="Password protected"
            description="Anyone with the password can join. Listed in Explore with a lock. Invite links work too."
          />
        </div>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
        <Field label="Hub name" icon={<Type className="size-3.5" />} error={errors.name}>
          {(props) => (
            <Input
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="Name your hub"
            />
          )}
        </Field>

        <Field label="Category" icon={<Shapes className="size-3.5" />} error={errors.category}>
          {(props) => (
            <Select {...props} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {ROOM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>

        {needsPassword && (
          <Field
            label="Hub password"
            icon={<KeyRound className="size-3.5" />}
            error={errors.password}
            hint="Share it with the people you want inside. At least 4 characters."
          >
            {(props) => (
              <PasswordInput
                {...props}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </Field>
        )}

        {errors._ && <p className="text-sm text-danger">{errors._}</p>}

        <Button
          type="submit"
          size="lg"
          variant={isPrivate ? "private" : "public"}
          loading={create.isPending}
        >
          Create{" "}
          {!isPrivate ? "public" : access === "invite" ? "invite-only" : "password-protected"} hub
        </Button>
      </form>
    </Panel>
  );
}

function AccessOption({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-xl p-3 text-left ring-1 transition",
        selected
          ? "bg-private-soft ring-private/60"
          : "bg-ink-950/40 ring-line hover:ring-private/40",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2 font-display text-sm font-semibold [&_svg]:size-4",
          selected ? "text-private" : "text-fg",
        )}
      >
        {icon}
        {title}
        {selected && <Check className="ml-auto" />}
      </span>
      <span className="text-xs leading-relaxed text-fg-muted">{description}</span>
    </button>
  );
}

function TypeTab({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "public" | "private";
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 font-display text-sm font-semibold transition [&_svg]:size-4",
        active
          ? tone === "public"
            ? "bg-public-soft text-public ring-1 ring-public/40"
            : "bg-private-soft text-private ring-1 ring-private/40"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
