"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { Check, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui/button";
import { backend } from "@/lib/backend";
import { DEMO_CODE } from "@/lib/backend/demo";
import { useApp } from "@/components/app/providers";
import { toast } from "@/components/ui/toast";

export default function Page() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const { refresh, demo } = useApp();
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [cool, setCool] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);

  const submit = async (code: string) => {
    setBusy(true);
    setErr("");
    try {
      await backend.verifyCode(email, code);
      setOk(true);
      await refresh();
      setTimeout(() => router.push("/painel/meu-negocio"), 1100);
    } catch (e) {
      setErr((e as Error).message);
      setDigits(Array(6).fill(""));
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const arr = clean.slice(0, 6).split("");
      const next = Array(6).fill("").map((_, j) => arr[j] ?? "");
      setDigits(next);
      refs.current[Math.min(arr.length, 5)]?.focus();
      if (arr.length === 6) submit(arr.join(""));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every((d) => d)) submit(next.join(""));
  };

  return (
    <AuthShell title="Confirme seu e-mail" subtitle={<>Digite o código de 6 dígitos que enviamos para <strong className="text-ink">{email || "seu e-mail"}</strong>.</>}>
      <AnimatePresence mode="wait">
        {ok ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 text-center">
            <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="grid size-20 place-items-center rounded-full bg-teal text-white shadow-xl">
              <Check className="size-10" />
            </motion.div>
            <p className="font-display mt-5 text-2xl font-bold">E-mail confirmado!</p>
            <p className="mt-1 text-ink-soft">Agora vamos cadastrar seu negócio…</p>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0, y: -10 }}>
            {demo && (
              <p className="mb-5 flex items-center gap-2 rounded-2xl bg-aqua/10 px-4 py-3 text-sm text-deep dark:text-aqua">
                <MailCheck className="size-4" /> Na demo, o código é <strong className="font-mono tracking-widest">{DEMO_CODE}</strong>
              </p>
            )}
            <div className={clsx("flex justify-between gap-2", err && "animate-shake")} onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData("text")); }}>
              {digits.map((d, i) => (
                <motion.input
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, scale: d ? [1, 1.08, 1] : 1 }}
                  transition={{ delay: i * 0.04 }}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  value={d}
                  disabled={busy}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                  }}
                  aria-label={`Dígito ${i + 1}`}
                  className={clsx(
                    "font-display h-16 w-full min-w-0 rounded-2xl border bg-surface text-center text-3xl font-bold outline-none transition sm:h-20",
                    d ? "border-teal" : "border-line",
                    "focus:border-teal focus:ring-4 focus:ring-aqua/25",
                  )}
                />
              ))}
            </div>
            {err && <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep" role="alert">{err}</p>}
            <div className="mt-6 flex items-center justify-between text-sm">
              <span className="text-ink-faint">Não recebeu?</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={cool > 0}
                onClick={async () => {
                  try {
                    await backend.resendCode(email);
                    toast.success("Código reenviado", "Confira também a caixa de spam.");
                    setCool(30);
                  } catch (e) {
                    toast.error("Não foi possível reenviar", (e as Error).message);
                  }
                }}
              >
                {cool > 0 ? `Reenviar em ${cool}s` : "Reenviar código"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
