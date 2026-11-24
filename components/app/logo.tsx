import { clsx } from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={clsx("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="lg-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fd0c9" />
          <stop offset="1" stopColor="#0b4f5c" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#lg-a)" />
      <path d="M8 25c3.5-3 6.5-3 10 0s6.5 3 10 0 3.5-2 4-2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8 31c3.5-3 6.5-3 10 0s6.5 3 10 0" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="14" cy="13" r="3.2" fill="#fff" />
      <circle cx="27" cy="11" r="3.2" fill="#ff7a59" />
      <path d="M14 13 L27 11" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 2.2" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-9" />
      <span className={clsx("font-display text-[1.35rem] font-extrabold tracking-tight", light ? "text-white" : "text-ink")}>
        Conecta<span className="text-coral">BC</span>
      </span>
    </span>
  );
}
