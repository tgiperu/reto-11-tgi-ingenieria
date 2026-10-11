import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "warn";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  danger: "border border-crit-fg bg-white text-crit-fg hover:bg-crit-bg",
  ghost: "border border-transparent bg-transparent text-ink hover:bg-sunken",
  primary: "border border-primary bg-primary text-white hover:bg-primary-2",
  secondary: "border-[1.5px] border-primary bg-white text-ink hover:bg-sunken",
  warn: "border border-warn-deep bg-warn-deep text-white hover:bg-warn",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "min-h-14 rounded-md px-5 text-base font-bold",
  md: "min-h-11 rounded-md px-4 text-sm font-semibold",
  sm: "min-h-9 rounded-md px-3 text-[13px] font-semibold",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string
): string {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      type={type}
      {...rest}
    />
  );
}
