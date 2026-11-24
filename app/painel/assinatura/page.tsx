"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { BadgeCheck, CalendarClock, Check, ChevronDown, CreditCard, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp } from "@/components/app/providers";
import { FlipClock } from "@/components/app/countdown";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/components/partner/propose-modal";
import { backend } from "@/lib/backend";
import { now } from "@/lib/clock";
import { earlySignupOpen, isLaunched, LAUNCH_AT, PRICE_LABEL } from "@/lib/launch";
import type { SubscriptionStatus } from "@/lib/types";
import { STATUS_INFO } from "@/lib/subscription-status";

const ease = [0.16, 1, 0.3, 1] as const;


export default function Page() {
  return (
    <RequireMember>
      <Suspense>
        <Subscription />
      </Suspense>
    </RequireMember>
  );
}

function Subscription() {
  const { session, refresh } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const celebrated = useRef(false);
  const n = now();
  const launched = isLaunched(n);
  const early = earlySignupOpen(n);
  const sub = session?.subscription;
  const status: SubscriptionStatus = sub?.status ?? "none";
  const info = STATUS_INFO[status];
  const managed = ["active", "trialing", "past_due", "unpaid", "paused"].includes(status);

  useEffect(() => {
    const s = params.get("status");
    if (s === "sucesso" && !celebrated.current) {
      celebrated.current = true;
      refresh();
      celebrate();
      toast.success(launched ? "Assinatura ativada! 🎉" : "Cartão cadastrado! 🎉", launched ? "Bem-vindo(a) à rede." : "A primeira cobrança será em 15/01/2027.");
      router.replace("/painel/assinatura");
    } else if (s === "cancelado") {
      toast.info("Checkout cancelado", "Nenhum valor foi cobrado.");
      router.replace("/painel/assinatura");
    }
  }, [params, refresh, router, launched]);

  const go = async (fn: () => Promise<{ url: string }>) => {
    setBusy(true);
    try {
      const { url } = await fn();
      if (url.startsWith("/")) router.push(url);
      else window.location.href = url;
    } catch (e) {
      toast.error("Não foi possível continuar", (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Assinatura</h1>
        <p className="mt-2 text-ink-soft">{launched ? `ConectaBC custa ${PRICE_LABEL}/mês, cobrados mensalmente em reais.` : `Grátis até 15/01/2027. Depois, ${PRICE_LABEL}/mês.`}</p>
      </motion.div>

      {!launched && (
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease }} className="relative mt-8 overflow-hidden rounded-[2rem] bg-[#01141a] p-6 text-white sm:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-teal/40 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-coral/20 blur-[100px]" />
          <p className="relative flex items-center gap-2 text-sm font-semibold text-aqua"><CalendarClock className="size-4" /> Lançamento: 15/01/2027, 00h (Brasília)</p>
          <FlipClock light className="relative mt-5" />
        </motion.section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.8, ease }} className="card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Sua situação</h2>
            <motion.span key={status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Pill tone={info.tone}>{info.label}</Pill>
            </motion.span>
          </div>
          <p className="mt-4 text-ink-soft">{!launched && status === "none" ? "Você tem acesso completo e gratuito até o lançamento. Cadastre o cartão agora para garantir a continuidade sem interrupção." : info.body}</p>

          {sub && (sub.trialEnd || sub.currentPeriodEnd) && (
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {sub.trialEnd && <Stat k="Primeira cobrança" v={new Date(sub.trialEnd).toLocaleDateString("pt-BR")} />}
              {sub.currentPeriodEnd && <Stat k="Próxima renovação" v={new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")} />}
              <Stat k="Valor" v={`${PRICE_LABEL}/mês`} />
            </dl>
          )}

          <div className="mt-7 space-y-3">
            {managed ? (
              <Button size="lg" variant="brand" className="w-full" loading={busy} icon={<CreditCard className="size-5" />} onClick={() => go(() => backend.openPortal())}>
                Gerenciar pagamento e cancelamento
              </Button>
            ) : launched ? (
              <Button size="lg" variant="primary" className="w-full" loading={busy} icon={<Sparkles className="size-5" />} onClick={() => go(() => backend.startCheckout())}>
                Assinar por {PRICE_LABEL}/mês
              </Button>
            ) : early ? (
              <>
                <Button size="lg" variant="primary" className="w-full" loading={busy} icon={<CreditCard className="size-5" />} onClick={() => go(() => backend.startCheckout())}>
                  Cadastrar cartão agora
                </Button>
                <p className="text-center text-xs text-ink-faint">Primeira cobrança agendada para {LAUNCH_AT.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Nada é cobrado antes.</p>
              </>
            ) : (
              <p className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                O cadastro antecipado está pausado nas 48 horas finais antes do lançamento. Volte a partir de 15/01/2027 para assinar.
              </p>
            )}
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
              <Lock className="size-3.5" /> Pagamento seguro processado pelo Stripe. Seu cartão nunca passa pelo ConectaBC.
            </p>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.8, ease }} className="conic-border rounded-[2rem]">
          <div className="card h-full rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <p className="font-semibold text-teal">Membro ConectaBC</p>
              <BadgeCheck className="size-6 text-teal" />
            </div>
            <p className="mt-2 flex items-end gap-1">
              <span className="font-display text-5xl font-bold">{PRICE_LABEL}</span>
              <span className="mb-1.5 text-ink-faint">/mês</span>
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {["Mapa e diretório completos", "Contatos de todos os membros", "Chat privado entre negócios", "Propostas de parceria", "Seu negócio visível na rede", "Sem fidelidade"].map((p) => (
                <li key={p} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-aqua/15 text-teal"><Check className="size-3" /></span>{p}</li>
              ))}
            </ul>
          </div>
        </motion.section>
      </div>

      <section className="mt-12">
        <h2 className="font-display mb-4 text-2xl font-bold">Perguntas frequentes</h2>
        <div className="space-y-2">
          {[
            ["Quando sou cobrado?", "Ninguém paga nada até 15/01/2027. Se você cadastrar o cartão antes, a primeira cobrança é agendada para essa data. Depois, a cobrança é mensal e automática."],
            ["Posso cancelar quando quiser?", "Sim. Use “Gerenciar pagamento e cancelamento” para trocar o cartão ou cancelar no portal seguro do Stripe. Não há multa nem fidelidade."],
            ["O que acontece se eu não assinar?", "Depois do lançamento você continua entrando na conta, editando seu negócio e gerenciando o pagamento, mas o mapa, o chat e as parcerias ficam bloqueados e seu negócio fica oculto. Nenhum dado é apagado."],
            ["Onde meu cartão fica guardado?", "No Stripe, um dos maiores processadores de pagamento do mundo. O ConectaBC nunca vê nem armazena os dados do cartão."],
          ].map(([q, a]) => (
            <Faq key={q} q={q} a={a} />
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint"><ShieldCheck className="size-4" /> O status mostrado aqui é verificado no servidor junto ao Stripe, não no seu navegador.</p>
      </section>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <dt className="text-xs text-ink-faint">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 p-4 text-left font-semibold" aria-expanded={open}>
        {q}
        <ChevronDown className={clsx("size-5 shrink-0 text-ink-faint transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }}>
            <p className="px-4 pb-4 text-ink-soft">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
