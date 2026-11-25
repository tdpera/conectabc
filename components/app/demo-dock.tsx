"use client";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, RotateCcw, Shield, Store, UserPlus, X, CalendarClock, LogIn } from "lucide-react";
import { clsx } from "clsx";
import { useApp } from "./providers";
import { backend } from "@/lib/backend";
import { timeTravelActive } from "@/lib/clock";
import { toast } from "@/components/ui/toast";

/** Painel flutuante para avaliadores explorarem a demo: troca de conta, viagem no tempo e reset. */
export function DemoDock() {
  const { demo, session, refresh } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [travel, setTravel] = useState(false);

  useEffect(() => setTravel(timeTravelActive()), [session]);
  if (!demo) return null;

  const act = async (key: string, fn: () => Promise<unknown>, msg: string, go?: string) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
      toast.success(msg);
      if (go) router.push(go);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  const goTime = (to: string) => {
    window.location.href = `${window.location.pathname}?agora=${to}`;
  };

  return (
    <div className={clsx("fixed right-3 z-[1500] lg:bottom-5 lg:left-5 lg:right-auto", session?.user ? "bottom-[6.75rem]" : "bottom-5")}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass absolute bottom-14 right-0 w-[min(20rem,calc(100vw-1.5rem))] origin-bottom-right rounded-3xl p-4 lg:left-0 lg:right-auto lg:origin-bottom-left"
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-bold">Modo demonstração</p>
                <p className="text-xs text-ink-soft">Dados 100% fictícios, salvos só neste navegador.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>

            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Entrar como</p>
            <div className="grid gap-1.5">
              <DockBtn icon={Store} busy={busy === "m"} active={session?.user?.id === "u-demo"} onClick={() => act("m", () => backend.demoLogin!("member"), "Você entrou como Café Maré Alta.", "/painel")}>
                Membro com negócio <span className="text-ink-faint">· Café Maré Alta</span>
              </DockBtn>
              <DockBtn icon={UserPlus} busy={busy === "n"} onClick={() => act("n", () => backend.demoLogin!("new"), "Conta nova criada. Cadastre seu negócio!", "/painel")}>
                Membro novo <span className="text-ink-faint">· sem negócio</span>
              </DockBtn>
              <DockBtn icon={Shield} busy={busy === "a"} active={session?.user?.isAdmin} onClick={() => act("a", () => backend.demoLogin!("admin"), "Você entrou como administrador.", "/admin")}>
                Administrador
              </DockBtn>
              {session?.user && (
                <DockBtn icon={LogIn} busy={busy === "o"} onClick={() => act("o", () => backend.signOut(), "Agora você é um visitante.", "/")}>
                  Visitante <span className="text-ink-faint">· sair da conta</span>
                </DockBtn>
              )}
            </div>

            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-widest text-ink-faint">Viajar no tempo</p>
            <div className="grid grid-cols-2 gap-1.5">
              <DockBtn icon={CalendarClock} active={!travel} onClick={() => goTime("real")}>Hoje</DockBtn>
              <DockBtn icon={CalendarClock} active={travel} onClick={() => goTime(new Date(Date.now() + 35 * 86400000).toISOString())}>Daqui a 35 dias</DockBtn>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">Em 35 dias o mês grátis já terminou: só quem assina continua visível.</p>

            <button
              onClick={() => act("r", () => backend.demoReset!(), "Dados da demo restaurados.")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-ink-soft hover:bg-surface-2"
            >
              <RotateCcw className={clsx("size-3.5", busy === "r" && "animate-spin")} /> Restaurar dados originais
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="glass flex items-center gap-2 rounded-full p-2 text-xs font-bold text-ink lg:py-2 lg:pl-2.5 lg:pr-3.5"
        aria-expanded={open}
      >
        <span className="relative grid size-6 place-items-center rounded-full bg-coral text-white">
          <FlaskConical className="size-3.5" />
          <span className="absolute inset-0 rounded-full bg-coral/60 animate-sonar" />
        </span>
        <span className="hidden lg:inline">Demo{travel ? " · em 35 dias" : ""}</span>
      </motion.button>
    </div>
  );
}

function DockBtn({ icon: Icon, children, onClick, busy, active }: { icon: typeof Store; children: React.ReactNode; onClick: () => void; busy?: boolean; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={clsx(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] font-semibold transition",
        active ? "border-teal/40 bg-aqua/10 text-ink" : "border-line bg-surface hover:border-teal/30 hover:bg-surface-2",
      )}
    >
      <Icon className={clsx("size-4 shrink-0", active ? "text-teal" : "text-ink-faint", busy && "animate-pulse")} />
      <span className="truncate">{children}</span>
    </button>
  );
}
