import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ArrowLeft, ImagePlus, LogIn, UserPlus } from "lucide-react";
import { loginSchema, signupSchema } from "@chatty/shared";
import {
  Avatar,
  Button,
  Field,
  Input,
  LoadingBlock,
  Logo,
  Panel,
  PasswordInput,
} from "../../components/ui";
import { ApiRequestError } from "../../lib/api";
import { useLogin, useMe, useSignup } from "./api";

type Mode = "welcome" | "login" | "signup";
type FieldErrors = Partial<Record<"username" | "password" | "_", string>>;

/** Turns zod or API validation issues into one message per field. */
function toFieldErrors(
  issues: Record<string, string[]> | { path: PropertyKey[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  const entries = Array.isArray(issues)
    ? issues.map((i) => [String(i.path[0] ?? "_"), i.message] as const)
    : Object.entries(issues).map(([k, v]) => [k, v[0] ?? ""] as const);
  for (const [key, message] of entries) errors[key as keyof FieldErrors] ??= message;
  return errors;
}

export function LoginPage() {
  const { data: user, isPending } = useMe();
  const [mode, setMode] = useState<Mode>("welcome");
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/currentservers";

  if (isPending) return <LoadingBlock />;
  if (user) return <Navigate to={from} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo className="text-6xl sm:text-7xl" />
        {mode === "welcome" && (
          <p className="max-w-sm leading-relaxed text-fg-muted">
            Where the chatter gets chatty! Build your own chat hubs, set up your profile and add
            your friends.
          </p>
        )}
      </div>

      {mode === "welcome" ? (
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<LogIn className="size-5" />}
            onClick={() => setMode("login")}
          >
            Login
          </Button>
          <Button
            size="lg"
            className="flex-1"
            icon={<UserPlus className="size-5" />}
            onClick={() => setMode("signup")}
          >
            New user
          </Button>
        </div>
      ) : (
        <Panel className="w-full animate-fade-up p-6 shadow-glow-primary sm:p-8">
          {mode === "login" ? (
            <LoginForm to={from} onBack={() => setMode("welcome")} />
          ) : (
            <SignupForm onBack={() => setMode("welcome")} />
          )}
        </Panel>
      )}
    </main>
  );
}

function FormHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        aria-label="Back"
        icon={<ArrowLeft className="size-4" />}
      />
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
    </div>
  );
}

function LoginForm({ to, onBack }: { to: string; onBack: () => void }) {
  const login = useLogin();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = loginSchema.safeParse({ username, password });
        if (!parsed.success) return setErrors(toFieldErrors(parsed.error.issues));
        setErrors({});
        login.mutate(parsed.data, {
          onSuccess: () => void navigate(to, { replace: true }),
          onError: (err) => setErrors({ _: err.message }),
        });
      }}
      className="flex flex-col gap-4"
    >
      <FormHeader title="Welcome back" onBack={onBack} />
      <Field label="Username" error={errors.username}>
        {(props) => (
          <Input
            {...props}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        )}
      </Field>
      <Field label="Password" error={errors.password}>
        {(props) => (
          <PasswordInput
            {...props}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        )}
      </Field>
      {errors._ && (
        <p role="alert" className="text-sm text-danger">
          {errors._}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={login.isPending} className="mt-2">
        Login
      </Button>
    </form>
  );
}

function SignupForm({ onBack }: { onBack: () => void }) {
  const signup = useSignup();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : undefined), [image]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = signupSchema.safeParse({ username, password });
        if (!parsed.success) return setErrors(toFieldErrors(parsed.error.issues));
        setErrors({});
        signup.mutate(
          { ...parsed.data, image },
          {
            onSuccess: () => void navigate("/currentservers", { replace: true }),
            onError: (err) =>
              setErrors(
                err instanceof ApiRequestError && err.issues
                  ? toFieldErrors(err.issues)
                  : err instanceof ApiRequestError && err.status === 409
                    ? { username: err.message }
                    : { _: err.message },
              ),
          },
        );
      }}
      className="flex flex-col gap-4"
    >
      <FormHeader title="Create your profile" onBack={onBack} />

      <label className="group flex cursor-pointer items-center gap-4 rounded-2xl p-3 ring-1 ring-line-strong ring-dashed transition hover:ring-primary has-focus-visible:ring-2 has-focus-visible:ring-primary">
        <Avatar
          src={preview}
          name={username || "?"}
          size="lg"
          ring={preview ? "primary" : "none"}
        />
        <span className="flex flex-col text-sm">
          <span className="flex items-center gap-1.5 font-medium text-fg group-hover:text-primary">
            <ImagePlus className="size-4" /> {image ? "Change photo" : "Add a profile photo"}
          </span>
          <span className="text-fg-subtle">PNG or JPEG, up to 5 MB. Optional.</span>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
      </label>

      <Field
        label="Username"
        error={errors.username}
        hint="3–24 letters, numbers, dots, dashes or underscores."
      >
        {(props) => (
          <Input
            {...props}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        )}
      </Field>
      <Field label="Password" error={errors.password} hint="At least 8 characters.">
        {(props) => (
          <PasswordInput
            {...props}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        )}
      </Field>
      {errors._ && (
        <p role="alert" className="text-sm text-danger">
          {errors._}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={signup.isPending} className="mt-2">
        Create account
      </Button>
    </form>
  );
}
