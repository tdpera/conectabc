import { clsx } from "clsx";
import type { ReactNode } from "react";
import { category } from "@/lib/categories";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function CategoryBadge({ id, className, glass }: { id: string; className?: string; glass?: boolean }) {
  const c = category(id);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        glass ? "glass-dark text-white" : "bg-surface-2 text-brand-ink",
        className,
      )}
    >
      <span aria-hidden>{c.emoji}</span>
      {c.label}
    </span>
  );
}

export function Pill({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "success" | "warn" | "danger" | "info"; className?: string }) {
  const tones = {
    default: "bg-surface-2 text-ink-soft",
    success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    danger: "bg-coral/15 text-coral-deep",
    info: "bg-aqua/15 text-deep dark:text-aqua",
  };
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-aqua/25 to-teal/10 text-4xl text-teal animate-float">{icon}</div>
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      {body && <p className="mt-2 max-w-md text-ink-soft">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, body, className, center }: { eyebrow?: string; title: ReactNode; body?: ReactNode; className?: string; center?: boolean }) {
  return (
    <div className={clsx(center && "mx-auto text-center", "max-w-2xl", className)}>
      {eyebrow && <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-ink">{eyebrow}</p>}
      <h2 className="font-display text-4xl font-bold leading-[1.02] sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-ink-soft">{body}</p>}
    </div>
  );
}
