"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { now } from "@/lib/clock";
import { PRICE_LABEL, timeUntilLaunch } from "@/lib/launch";

export function useCountdown() {
  const [t, setT] = useState<ReturnType<typeof timeUntilLaunch> | null>(null);
  useEffect(() => {
    const tick = () => setT(timeUntilLaunch(now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return t;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function CountdownBar({ dark }: { dark?: boolean }) {
  const t = useCountdown();
  return (
    <Link
      href="/painel/assinatura"
      className={clsx(
        "group flex h-8 items-center justify-center gap-2 overflow-hidden px-3 text-[12px] font-medium transition-colors sm:text-[13px]",
        dark ? "bg-abyss/70 text-white" : "bg-abyss text-foam",
      )}
    >
      <Sparkles className="size-3.5 shrink-0 text-coral" />
      <span className="truncate">
        <strong className="font-semibold">Grátis até 15/01/2027.</strong>
        <span className="hidden sm:inline"> Depois, {PRICE_LABEL}/mês.</span>
      </span>
      {t && (
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 tabular-nums tracking-tight">
          {t.days}d {pad(t.hours)}h {pad(t.minutes)}m <span className="hidden sm:inline">{pad(t.seconds)}s</span>
        </span>
      )}
      <span className="hidden text-aqua group-hover:underline md:inline">Garantir minha vaga →</span>
    </Link>
  );
}

function FlipDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block h-[1.1em] w-[0.68em] overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "-100%", rotateX: 70, opacity: 0 }}
          animate={{ y: "0%", rotateX: 0, opacity: 1 }}
          exit={{ y: "100%", rotateX: -70, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="absolute inset-0 grid place-items-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function FlipClock({ className, light }: { className?: string; light?: boolean }) {
  const t = useCountdown();
  const parts: [string, string][] = t
    ? [[String(t.days).padStart(2, "0"), "dias"], [pad(t.hours), "horas"], [pad(t.minutes), "min"], [pad(t.seconds), "seg"]]
    : [["--", "dias"], ["--", "horas"], ["--", "min"], ["--", "seg"]];
  return (
    <div className={clsx("flex items-start gap-1.5 sm:gap-4", className)} aria-label="Tempo até o lançamento" role="timer">
      {parts.map(([v, label], i) => (
        <div key={label} className="flex items-start gap-2 sm:gap-4">
          <div className="text-center">
            <div
              className={clsx(
                "font-display flex whitespace-nowrap rounded-2xl px-2 py-2 text-4xl font-bold tabular-nums sm:px-4 sm:text-6xl",
                light ? "glass-dark text-white" : "card text-ink",
              )}
              style={{ perspective: 400 }}
            >
              {v.split("").map((d, j) => (
                <FlipDigit key={j} value={d} />
              ))}
            </div>
            <p className={clsx("mt-2 text-[11px] font-semibold uppercase tracking-[0.18em]", light ? "text-white/60" : "text-ink-faint")}>{label}</p>
          </div>
          {i < 3 && <span className={clsx("font-display pt-3 text-3xl font-bold sm:pt-5 sm:text-5xl", light ? "text-white/30" : "text-ink-faint/50")}>:</span>}
        </div>
      ))}
    </div>
  );
}
