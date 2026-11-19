import type { ReactNode } from "react";
import { BellRing, Mail } from "lucide-react";
import { Panel, Spinner } from "../../components/ui";
import { cn } from "../../lib/cn";
import { useCurrentUser } from "../auth/currentUser";
import { usePopupState, useSetEmailAlerts, useSetPopups, type PopupState } from "./alerts";

function Toggle({
  label,
  checked,
  disabled,
  busy,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-ink-600",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 flex size-5 items-center justify-center rounded-full bg-ink-100 shadow transition-transform",
          checked && "translate-x-5",
        )}
      >
        {busy && <Spinner className="size-3 text-ink-900" />}
      </span>
    </button>
  );
}

function Row({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-3">
      <span className="mt-0.5 text-fg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-fg-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

const popupHints: Record<PopupState, string> = {
  unsupported:
    "This browser can't show pop-ups. On iPhone, add Chatty Chatter to your home screen first.",
  unavailable: "Pop-ups aren't available right now.",
  blocked: "Your browser is blocking pop-ups from Chatty Chatter. Allow them in its site settings.",
  off: "Get a pop-up on this device when something happens and you're not looking.",
  on: "On for this device. Lots of messages from one hub show as a single pop-up.",
};

/** Email and pop-up alert switches, at the top of the notifications page. */
export function AlertSettings() {
  const user = useCurrentUser();
  const setEmail = useSetEmailAlerts();
  const { data: popups } = usePopupState();
  const setPopups = useSetPopups();
  const canEmail = Boolean(user.email && user.emailVerified);
  const emailOn = canEmail && user.emailAlerts !== false;

  return (
    <Panel className="divide-y divide-line p-1">
      <Row
        icon={<Mail className="size-4" />}
        title="Email me when I'm away"
        hint={
          canEmail ? (
            <>
              If something sits unread for 15 minutes, we send one email to {user.email}. No more
              until you're back.
            </>
          ) : (
            "Add and verify an email to get these."
          )
        }
      >
        <Toggle
          label="Email alerts"
          checked={emailOn}
          disabled={!canEmail}
          busy={setEmail.isPending}
          onChange={(on) => setEmail.mutate(on)}
        />
      </Row>
      <Row
        icon={<BellRing className="size-4" />}
        title="Pop-up alerts"
        hint={
          <>
            {popups ? popupHints[popups] : "Checking this browser…"}
            {setPopups.isError && (
              <span className="mt-1 block text-danger">{setPopups.error.message}</span>
            )}
          </>
        }
      >
        <Toggle
          label="Pop-up alerts"
          checked={popups === "on"}
          disabled={popups !== "on" && popups !== "off"}
          busy={setPopups.isPending}
          onChange={(on) => setPopups.mutate(on)}
        />
      </Row>
    </Panel>
  );
}
