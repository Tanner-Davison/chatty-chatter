import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { resetPasswordSchema } from "@chatty/shared";
import { Button, Field, LoadingBlock, Logo, Panel, PasswordInput } from "../../components/ui";
import { useUnsubscribe } from "../notifications/alerts";
import { useMe, useResetPassword, useVerifyEmail } from "./api";

/** Centered card layout for the pages people reach from emailed links. */
function LinkPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
      <Link to="/">
        <Logo className="text-5xl" />
      </Link>
      <Panel className="w-full animate-fade-up p-6 sm:p-8">{children}</Panel>
    </main>
  );
}

function Outcome({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {ok ? (
        <CheckCircle2 className="size-10 text-primary" />
      ) : (
        <XCircle className="size-10 text-danger" />
      )}
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

/** /verify-email?token=… — confirms the address as soon as the page opens. */
export function VerifyEmailPage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const verify = useVerifyEmail();
  const { data: me } = useMe();
  const started = useRef(false);

  useEffect(() => {
    // Once only, even when React runs effects twice in development.
    if (started.current || !token) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  const next = me ? "/currentservers" : "/";
  return (
    <LinkPage>
      {!token ? (
        <Outcome ok={false} title="This link is incomplete">
          <p className="text-sm text-fg-muted">
            Open the link from your email again, or request a new one.
          </p>
        </Outcome>
      ) : verify.isPending || verify.isIdle ? (
        <LoadingBlock label="Verifying your email" />
      ) : verify.isSuccess ? (
        <Outcome ok title="Email verified">
          <p className="text-sm text-fg-muted">
            You can now reset your password with it and get alerts.
          </p>
          <Link to={next} className="mt-2 font-medium text-primary hover:underline">
            {me ? "Back to Chatty Chatter" : "Log in"}
          </Link>
        </Outcome>
      ) : (
        <Outcome ok={false} title="Couldn't verify">
          <p className="text-sm text-fg-muted">{verify.error.message}</p>
          <Link to={next} className="mt-2 font-medium text-primary hover:underline">
            {me ? "Back to Chatty Chatter to resend it" : "Log in to resend it"}
          </Link>
        </Outcome>
      )}
    </LinkPage>
  );
}

/** /reset-password?token=… — choose a new password. */
export function ResetPasswordPage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const reset = useResetPassword();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  if (reset.isSuccess) {
    return (
      <LinkPage>
        <Outcome ok title="Password updated">
          <p className="text-sm text-fg-muted">Log in with your new password.</p>
          <Button
            variant="primary"
            className="mt-2"
            onClick={() => void navigate("/", { replace: true })}
          >
            Log in
          </Button>
        </Outcome>
      </LinkPage>
    );
  }

  return (
    <LinkPage>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = resetPasswordSchema.safeParse({ token, password });
          if (!parsed.success) return setError(parsed.error.issues[0]?.message);
          setError(undefined);
          reset.mutate(parsed.data, { onError: (err) => setError(err.message) });
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
        </div>
        <Field label="New password" error={error} hint="At least 8 characters.">
          {(props) => (
            <PasswordInput
              {...props}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={reset.isPending}>
          Save new password
        </Button>
      </form>
    </LinkPage>
  );
}

/** /unsubscribe?token=… — the link at the bottom of alert emails. Works logged out. */
export function UnsubscribePage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const unsubscribe = useUnsubscribe();
  const { data: me } = useMe();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    unsubscribe.mutate(token);
  }, [token, unsubscribe]);

  return (
    <LinkPage>
      {unsubscribe.isPending || (token && unsubscribe.isIdle) ? (
        <LoadingBlock label="Turning off alert emails" />
      ) : unsubscribe.isSuccess ? (
        <Outcome ok title="Alert emails are off">
          <p className="text-sm text-fg-muted">
            You won't get any more. Turn them back on anytime from your notifications page.
          </p>
          <Link
            to={me ? "/notifications" : "/"}
            className="mt-2 font-medium text-primary hover:underline"
          >
            {me ? "Go to notifications" : "Log in"}
          </Link>
        </Outcome>
      ) : (
        <Outcome ok={false} title="Couldn't unsubscribe">
          <p className="text-sm text-fg-muted">
            {unsubscribe.error?.message ?? "This link is incomplete."} You can turn alert emails off
            from your notifications page.
          </p>
          <Link to="/notifications" className="mt-2 font-medium text-primary hover:underline">
            Go to notifications
          </Link>
        </Outcome>
      )}
    </LinkPage>
  );
}
