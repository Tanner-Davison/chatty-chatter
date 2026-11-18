import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

const variants = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-strong hover:shadow-glow-primary font-semibold",
  secondary:
    "bg-surface-overlay text-fg ring-1 ring-line-strong hover:ring-primary/60 hover:text-primary",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-overlay",
  public: "bg-public-soft text-public ring-1 ring-public/40 hover:shadow-glow-public",
  private: "bg-private-soft text-private ring-1 ring-private/40 hover:shadow-glow-private",
  danger: "bg-danger-soft text-danger ring-1 ring-danger/40 hover:bg-danger hover:text-ink-950",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition duration-150",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  size?: "sm" | "md";
}

export function IconButton({
  label,
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-lg text-fg-muted transition",
        "hover:bg-surface-overlay hover:text-fg disabled:opacity-50",
        size === "sm" ? "size-8 [&_svg]:size-4" : "size-10 [&_svg]:size-5",
        className,
      )}
      {...props}
    />
  );
}
