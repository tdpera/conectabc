"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { BadgeCheck, CalendarClock, Check, ChevronDown, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp } from "@/components/app/providers";
import { JoinFirst } from "@/components/app/gates";
import { ReferralCard } from "@/components/app/referral-card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/components/partner/propose-modal";
import { backend } from "@/lib/backend";
import { now } from "@/lib/clock";
import { checkoutTrialEnd, freeActive, PRICE_LABEL, REFERRAL_MONTHS, REFERRAL_PRICE_LABEL } from "@/lib/plan";
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
  const m = session?.membership ?? null;
  const free = freeActive(m, n);
  const trialEnd = checkoutTrialEnd(m, n);
  const sub = session?.subscription;
  const status: SubscriptionStatus = sub?.status ?? "none";
  const info = STATUS_INFO[status];
  const managed = ["active", "trialing", "past_due", "unpaid", "paused"].includes(status);
  const off = !!m?.referredCode && (status === "none" || status === "incomplete");
  const price = off ? REFERRAL_PRICE_LABEL : PRICE_LABEL;

  useEffect(() => {
    const s = params.get("status");
    if (s === "sucesso" && !celebrated.current) {
      celebrated.current = true;
      refresh();
      celebrate();
      toast.success("Tudo certo!", "Sua assinatura foi registrada.");
      router.replace("/painel/assinatura");
    } else if (s === "cancelado") {
      toast.info("Checkout cancelado", "Nenhum valor foi cobrado.");
      router.replace("/painel/assinatura");
    }
  }, [params, refresh, router]);

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

  if (!session?.business && !session?.user?.isAdmin) return <div className="pt-[var(--hh,96px)]"><JoinFirst /></div>;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Assinatura</h1>
        <p className="mt-2 text-ink-soft">ConectaBC custa {PRICE_LABEL}/mês, cobrados mensalmente em reais, sem fidelidade.</p>
      </motion.div>

      {free && (
        <p className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-aqua/10 px-5 py-4 text-ink">
          <CalendarClock className="size-5 text-teal" />
          <strong>Negócio nº {m!.founderNumber} da rede.</strong> Grátis até {new Date(m!.freeUntil!).toLocaleDateString("pt-BR")}.
        </p>
      )}

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[1.2fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.8, ease }} className="card rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Sua situação</h2>
            <motion.span key={status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Pill tone={free && !managed ? "success" : info.tone}>{free && !managed ? "Mês grátis" : info.label}</Pill>
            </motion.span>
          </div>
          <p className="mt-4 text-ink-soft">{free && !managed ? "Você tem acesso completo durante o mês grátis. Cadastre um cartão quando quiser para continuar depois, sem interrupção." : m?.freeUntil && status === "none" ? "Seu mês grátis terminou. Assine para reaparecer no mapa e voltar a conversar." : info.body}</p>

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
            ) : (
              <>
                <Button size="lg" variant="primary" className="w-full" loading={busy} icon={<CreditCard className="size-5" />} onClick={() => go(() => backend.startCheckout())}>
                  {trialEnd ? "Cadastrar cartão" : `Assinar por ${price}/mês`}
                </Button>
                {trialEnd && <p className="text-center text-xs text-ink-faint">Primeira cobrança em {trialEnd.toLocaleDateString("pt-BR")}. Nada é cobrado antes.</p>}
              </>
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
              <span className="font-display whitespace-nowrap text-4xl font-bold sm:text-5xl">{price}</span>
              <span className="mb-1.5 text-ink-faint">/mês</span>
            </p>
            {off && <p className="text-sm text-ink-soft">por {REFERRAL_MONTHS} meses com sua indicação, depois {PRICE_LABEL}</p>}
            <ul className="mt-6 space-y-2.5 text-sm">
              {["Mapa e diretório completos", "Contatos de todos os membros", "Chat privado entre negócios", "Propostas de parceria", "Seu negócio visível na rede", "Sem fidelidade"].map((p) => (
                <li key={p} className="flex items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-aqua/15 text-teal"><Check className="size-3" /></span>{p}</li>
              ))}
            </ul>
          </div>
        </motion.section>
      </div>

      <ReferralCard />

      <section className="mt-12">
        <h2 className="font-display mb-4 text-2xl font-bold">Perguntas frequentes</h2>
        <div className="space-y-2">
          {[
            ["Quando sou cobrado?", "Os 100 primeiros negócios ganham um mês grátis, sem cartão. Quem cadastra o cartão durante esse mês só paga quando ele termina. Nos outros casos, a cobrança começa ao assinar e é mensal."],
            ["Como funciona a indicação?", "Quem cadastra o negócio com o código de um membro ganha 10% de desconto nas 3 primeiras mensalidades. Se tiver o mês grátis, o desconto vem depois dele."],
            ["Posso cancelar quando quiser?", "Sim. Use “Gerenciar pagamento e cancelamento” para trocar o cartão ou cancelar no portal seguro do Stripe. Não há multa nem fidelidade."],
            ["O que acontece se eu não assinar?", "Você continua entrando na conta, editando seu negócio e gerenciando o pagamento, mas os contatos, o chat e as parcerias ficam bloqueados e seu negócio fica oculto. Nenhum dado é apagado."],
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
