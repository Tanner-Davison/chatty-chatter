import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

const control =
  "w-full rounded-xl bg-ink-950/60 px-3.5 text-sm text-fg ring-1 ring-line-strong transition " +
  "placeholder:text-fg-subtle hover:ring-ink-500 focus:outline-none focus:ring-2 focus:ring-primary " +
  "aria-invalid:ring-danger disabled:opacity-60";

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/** A label, a control and its hint or error, wired together for screen readers. */
export function Field({ label, error, hint, icon, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-fg-muted uppercase"
      >
        {icon}
        {label}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        ...(message && { "aria-describedby": messageId }),
      })}
      {message && (
        <p id={messageId} className={cn("text-xs", error ? "text-danger" : "text-fg-subtle")}>
          {message}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        className={cn(control, "h-11 pr-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-fg-subtle hover:text-fg"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-28 resize-y py-3", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-11 cursor-pointer", className)} {...props} />;
}
