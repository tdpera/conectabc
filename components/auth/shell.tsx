"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo } from "react";
import { BayMap } from "@/components/home/bay-map";
import { decorativePins } from "@/lib/bay";
import { Logo } from "@/components/app/logo";

const ease = [0.16, 1, 0.3, 1] as const;

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const pins = useMemo(() => decorativePins(28), []);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#01141a] lg:block">
        <div className="absolute inset-0" style={{ background: "radial-gradient(80% 60% at 80% 0%, rgba(255,140,100,.22), transparent 60%), radial-gradient(120% 80% at 50% 0%, #0f6f73 0%, #0b4f5c 30%, #03222b 70%, #01141a 100%)" }} />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.6, ease }} className="absolute inset-y-0 -right-10 left-10">
          <BayMap pins={pins} glow interactive={false} idPrefix="auth" className="size-full" />
        </motion.div>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/"><Logo light /></Link>
          <motion.blockquote initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 1, ease }} className="max-w-md">
            <p className="font-display text-4xl font-bold leading-[1.05]">“A pousada da esquina virou nossa maior fonte de clientes.”</p>
            <p className="mt-4 text-sm text-white/60">É esse tipo de parceria que o ConectaBC quer facilitar.</p>
          </motion.blockquote>
        </div>
      </div>
      <div className="flex flex-col px-5 pb-10 pt-[calc(var(--hh,96px)+1.5rem)] sm:px-10 lg:pt-[calc(var(--hh,96px)+3rem)]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="mx-auto w-full max-w-md">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-ink-soft">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-ink-soft">{footer}</div>}
        </motion.div>
      </div>
    </main>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
