"use client";
import { clsx } from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";

const control =
  "peer w-full rounded-2xl border border-line bg-surface px-4 pb-2.5 pt-6 text-[15px] text-ink outline-none transition placeholder:text-transparent focus:border-teal focus:ring-4 focus:ring-aqua/20 aria-[invalid=true]:border-coral";

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="pointer-events-none absolute left-4 top-4 origin-left text-[15px] text-ink-faint transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-teal peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
    >
      {children}
    </label>
  );
}

export function Field({ label, hint, className, counter, ...rest }: ComponentProps<"input"> & { label: string; hint?: ReactNode; counter?: number }) {
  const id = useId();
  return (
    <div className={clsx("relative", className)}>
      <input id={id} placeholder={label} className={control} {...rest} />
      <Label htmlFor={id}>{label}</Label>
      {(hint || counter !== undefined) && (
        <div className="mt-1.5 flex justify-between gap-2 px-1 text-xs text-ink-faint">
          <span>{hint}</span>
          {counter !== undefined && rest.maxLength && <span>{counter}/{rest.maxLength}</span>}
        </div>
      )}
    </div>
  );
}

export function TextArea({ label, hint, className, counter, ...rest }: ComponentProps<"textarea"> & { label: string; hint?: ReactNode; counter?: number }) {
  const id = useId();
  return (
    <div className={clsx("relative", className)}>
      <textarea id={id} placeholder={label} className={clsx(control, "min-h-28 resize-y pt-7")} {...rest} />
      <Label htmlFor={id}>{label}</Label>
      {(hint || counter !== undefined) && (
        <div className="mt-1.5 flex justify-between gap-2 px-1 text-xs text-ink-faint">
          <span>{hint}</span>
          {counter !== undefined && rest.maxLength && (
            <span className={clsx(counter > rest.maxLength * 0.9 && "text-coral-deep")}>{counter.toLocaleString("pt-BR")}/{rest.maxLength.toLocaleString("pt-BR")}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function Select({ label, children, className, ...rest }: ComponentProps<"select"> & { label: string }) {
  const id = useId();
  return (
    <div className={clsx("relative", className)}>
      <select id={id} className={clsx(control, "appearance-none pr-10")} {...rest}>
        {children}
      </select>
      <label htmlFor={id} className="pointer-events-none absolute left-4 top-2 text-xs font-semibold text-ink-faint">{label}</label>
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-faint">▾</span>
    </div>
  );
}
