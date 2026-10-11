import { cn } from "@reto-11-tgi-ingenieria/ui/lib/utils";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";

const CONTROL =
  "min-h-11 w-full rounded-lg border border-edge bg-white px-3 text-sm text-ink placeholder:text-ink-3/70 focus-visible:border-primary";

export function TextField({
  label,
  hint,
  className,
  mono,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-ink-3 text-xs" htmlFor={id}>
        {label}
      </label>
      <input
        className={cn(CONTROL, mono && "font-mono", className)}
        id={id}
        {...rest}
      />
      {hint ? <span className="text-ink-3 text-xs">{hint}</span> : null}
    </div>
  );
}

export function SelectField({
  label,
  children,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-ink-3 text-xs" htmlFor={id}>
        {label}
      </label>
      <select className={cn(CONTROL, className)} id={id} {...rest}>
        {children}
      </select>
    </div>
  );
}

export function TextAreaField({
  label,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-semibold text-ink-3 text-xs" htmlFor={id}>
        {label}
      </label>
      <textarea
        className={cn(CONTROL, "min-h-20 py-2", className)}
        id={id}
        {...rest}
      />
    </div>
  );
}
