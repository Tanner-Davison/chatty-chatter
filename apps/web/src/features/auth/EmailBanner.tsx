import { useState } from "react";
import { MailCheck, MailWarning } from "lucide-react";
import { emailSchema } from "@chatty/shared";
import { Button, Input } from "../../components/ui";
import { useResendVerification, useUpdateEmail } from "./api";
import { useCurrentUser } from "./currentUser";

/**
 * Shown on every page until the account has a verified email: older accounts
 * add one here; everyone else is reminded to click their link.
 */
export function EmailBanner() {
  const user = useCurrentUser();
  const update = useUpdateEmail();
  const resend = useResendVerification();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  if (user.email && user.emailVerified) return null;

  const showForm = !user.email || editing;
  const save = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    update.mutate(parsed.data, {
      onSuccess: () => {
        setEditing(false);
        setEmail("");
      },
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
        {showForm ? (
          <>
            <span className="flex items-center gap-2 text-fg">
              <MailWarning className="size-4 text-warning" />
              {user.email
                ? "Change your email:"
                : "Add an email to secure your account and reset your password:"}
            </span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="flex flex-1 flex-wrap items-center gap-2"
            >
              <Input
                type="email"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="h-9 max-w-xs"
              />
              <Button type="submit" size="sm" variant="primary" loading={update.isPending}>
                Save
              </Button>
              {editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              {error && <span className="text-danger">{error}</span>}
            </form>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2 text-fg">
              <MailCheck className="size-4 text-warning" />
              Check <span className="font-medium">{user.email}</span> for a link to verify your
              email.
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                loading={resend.isPending}
                disabled={resend.isSuccess}
                onClick={() => resend.mutate()}
              >
                {resend.isSuccess ? "Sent" : "Resend"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Change
              </Button>
            </div>
            {resend.isError && <span className="text-danger">{resend.error.message}</span>}
          </>
        )}
      </div>
    </div>
  );
}
