import type { CSSProperties, ReactNode } from "react";
import { Bell, Lock, Plus, Trash2 } from "lucide-react";
import type { RoomSummary } from "@chatty/shared";
import {
  Avatar,
  Badge,
  Button,
  Field,
  IconButton,
  Input,
  Logo,
  Panel,
  PanelHeader,
  PasswordInput,
  Select,
  Spinner,
  StatusDot,
  Textarea,
} from "../../components/ui";

const swatches: { name: string; token: string; role: string }[] = [
  {
    name: "Primary",
    token: "--color-primary",
    role: "Your actions, your messages, focus, active nav",
  },
  { name: "Public", token: "--color-public", role: "Public hubs, connected" },
  { name: "Private", token: "--color-private", role: "Private hubs, locks, passwords" },
  { name: "Danger", token: "--color-danger", role: "Destructive actions, errors" },
  { name: "Warning", token: "--color-warning", role: "Attention without danger" },
];
const inks = ["950", "900", "850", "800", "700", "600", "500", "400", "300", "200", "100"];

const sampleRoom = (n: number, name: string, isPrivate = false): RoomSummary => ({
  _id: String(n),
  room_number: n,
  room_name: name,
  private_room: isPrivate,
  created_by: "tanner",
  users_in_room: ["a", "b", "c"],
});

/** Development-only reference for the design system: tokens and every UI component. */
export function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <Logo className="text-4xl" />
        <h1 className="font-display text-3xl font-bold">Design system</h1>
        <p className="text-fg-muted">
          Tokens live in <code className="text-primary">src/styles/index.css</code>, components in{" "}
          <code className="text-primary">src/components/ui</code>.
        </p>
      </header>

      <Section title="Role colours">
        <div className="grid gap-3 sm:grid-cols-5">
          {swatches.map((s) => (
            <div key={s.name} className="flex flex-col gap-2">
              <div
                className="h-16 rounded-xl ring-1 ring-line"
                style={{ background: `var(${s.token})` }}
              />
              <p className="font-display font-semibold">{s.name}</p>
              <p className="text-xs text-fg-subtle">{s.role}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex overflow-hidden rounded-xl ring-1 ring-line">
          {inks.map((i) => (
            <div
              key={i}
              className="flex h-12 flex-1 items-end p-1 text-[10px] text-fg-subtle"
              style={{ background: `var(--color-ink-${i})` }}
            >
              {i}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-4xl font-bold tracking-tight">Space Grotesk display</p>
        <p className="mt-2 text-fg-muted">
          Inter for body text. Muted for secondary copy,{" "}
          <span className="text-fg-subtle">subtle for hints</span>.
        </p>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button variant="primary" icon={<Plus className="size-4" />}>
            Primary
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="public">Public</Button>
          <Button variant="private" icon={<Lock className="size-4" />}>
            Private
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            Danger
          </Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <IconButton label="Notifications">
            <Bell />
          </IconButton>
        </Row>
      </Section>

      <Section title="Badges and status">
        <Row>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="public">Public</Badge>
          <Badge tone="private">
            <Lock /> Private
          </Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge>Neutral</Badge>
          <StatusDot online />
          <StatusDot online={false} />
          <Spinner className="text-primary" />
        </Row>
      </Section>

      <Section title="Avatars">
        <Row>
          <Avatar name="tanner" size="xs" />
          <Avatar name="tanner" size="sm" ring="primary" />
          <Avatar name="ben" size="md" ring="public" />
          <Avatar name="cara" size="lg" ring="private" />
        </Row>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Text" hint="A hint under the field.">
            {(p) => <Input {...p} placeholder="Placeholder" />}
          </Field>
          <Field label="With error" error="This field has a problem.">
            {(p) => <Input {...p} defaultValue="Bad value" />}
          </Field>
          <Field label="Password">{(p) => <PasswordInput {...p} defaultValue="secret" />}</Field>
          <Field label="Select">
            {(p) => (
              <Select {...p}>
                <option>Option</option>
              </Select>
            )}
          </Field>
          <Field label="Textarea" className="sm:col-span-2">
            {(p) => <Textarea {...p} placeholder="Tell your story" />}
          </Field>
        </div>
      </Section>

      <Section title="Hub tiles">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["var(--color-primary)", sampleRoom(1, "Subscribed")],
              ["var(--color-public)", sampleRoom(2, "Public hub")],
              ["var(--color-private)", sampleRoom(3, "Private hub", true)],
              ["var(--color-ink-400)", sampleRoom(4, "Explore")],
            ] as const
          ).map(([color, room]) => (
            <div
              key={room._id}
              style={{ "--tile-color": color } as CSSProperties}
              className="tile-checker flex aspect-square items-center justify-center rounded-tile font-display font-semibold ring-1 ring-[color-mix(in_oklab,var(--tile-color)_45%,transparent)]"
            >
              {room.room_name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Chat bubbles">
        <div className="flex flex-col gap-2">
          <p className="max-w-xs self-start rounded-2xl rounded-tl-md bg-surface-overlay px-4 py-2.5 ring-1 ring-line-strong">
            Someone else's message
          </p>
          <p className="max-w-xs self-end rounded-2xl rounded-tr-md bg-gradient-to-br from-primary to-primary-strong px-4 py-2.5 text-primary-fg shadow-glow-primary">
            Your message
          </p>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="p-6">
      <PanelHeader title={title} accent="primary" className="mb-4" />
      {children}
    </Panel>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
