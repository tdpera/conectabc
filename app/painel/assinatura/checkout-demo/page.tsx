"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { FlaskConical, Lock } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp } from "@/components/app/providers";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { demoBilling } from "@/lib/backend/demo";
import { checkoutTrialEnd, PRICE_LABEL, REFERRAL_MONTHS, REFERRAL_PRICE_LABEL } from "@/lib/plan";
import { now } from "@/lib/clock";

/** Checkout SIMULADO, só existe no modo demonstração. No modo real, o usuário vai para o checkout hospedado do Stripe. */
export default function Page() {
  const { demo, refresh, session } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!demo) return null;
  const m = session?.membership ?? null;
  const trialEnd = checkoutTrialEnd(m, now());
  const off = !!m?.referredCode && !session?.subscription;
  return (
    <RequireMember>
      <main className="mx-auto max-w-md px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card rounded-[2rem] p-6 sm:p-8">
          <p className="mb-4 flex items-center gap-2 rounded-2xl bg-coral/10 px-3 py-2 text-xs font-semibold text-coral-deep">
            <FlaskConical className="size-4" /> Checkout de demonstração — nenhum valor é cobrado
          </p>
          <h1 className="font-display text-3xl font-bold">ConectaBC · Membro</h1>
          <p className="mt-1 text-ink-soft">{off ? `${REFERRAL_PRICE_LABEL}/mês por ${REFERRAL_MONTHS} meses, depois ${PRICE_LABEL}` : `${PRICE_LABEL}/mês`}. {trialEnd ? `Primeira cobrança em ${trialEnd.toLocaleDateString("pt-BR")}.` : "Cobrança a partir de hoje."}</p>
          <div className="mt-6 space-y-3">
            <Field label="Número do cartão (fictício)" value="4242 4242 4242 4242" readOnly />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Validade" value="12/30" readOnly />
              <Field label="CVC" value="123" readOnly />
            </div>
          </div>
          <Button
            size="lg"
            variant="primary"
            className="mt-6 w-full"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await demoBilling.completeCheckout();
                await refresh();
                router.push("/painel/assinatura?status=sucesso");
              } catch (e) {
                toast.error("Não foi possível concluir", (e as Error).message);
                setBusy(false);
              }
            }}
          >
            {trialEnd ? "Cadastrar cartão (simulação)" : "Assinar (simulação)"}
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push("/painel/assinatura?status=cancelado")}>Voltar</Button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-faint"><Lock className="size-3.5" /> No app real, esta etapa acontece na página segura do Stripe.</p>
        </motion.div>
      </main>
    </RequireMember>
  );
}
