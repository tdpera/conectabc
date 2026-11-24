"use client";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "info";
interface T { id: number; kind: Kind; title: string; body?: string }

let push: ((t: Omit<T, "id">) => void) | null = null;
let seq = 0;

export const toast = {
  success: (title: string, body?: string) => push?.({ kind: "success", title, body }),
  error: (title: string, body?: string) => push?.({ kind: "error", title, body }),
  info: (title: string, body?: string) => push?.({ kind: "info", title, body }),
};

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const COLOR = { success: "text-teal", error: "text-coral-deep", info: "text-deep" };
const BAR = { success: "bg-aqua", error: "bg-coral", info: "bg-teal" };

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = ++seq;
      setItems((s) => [...s.slice(-3), { ...t, id }]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4800);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[2000] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.92, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl p-4 pr-10"
              role="status"
            >
              <div className="flex gap-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${COLOR[t.kind]}`} />
                <div>
                  <p className="font-semibold leading-snug text-ink">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-ink-soft">{t.body}</p>}
                </div>
              </div>
              <button className="absolute right-3 top-3 text-ink-faint hover:text-ink" aria-label="Fechar" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}>
                <X className="size-4" />
              </button>
              <motion.div className={`absolute bottom-0 left-0 h-0.5 ${BAR[t.kind]}`} initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ duration: 4.8, ease: "linear" }} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
