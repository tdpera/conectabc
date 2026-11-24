"use client";
import { motion } from "motion/react";
import { Lock, Sparkles, ShieldCheck, Store } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PRICE_LABEL } from "@/lib/launch";

const ease = [0.16, 1, 0.3, 1] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-[calc(100dvh-var(--hh,64px))] place-items-center overflow-hidden px-5 py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-aqua/15 blur-[120px]" />
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, ease }} className="relative w-full max-w-lg">
        {children}
      </motion.div>
    </div>
  );
}

/** Visitante após o lançamento. */
export function LockScreen() {
  return (
    <Shell>
      <div className="card rounded-[2rem] p-8 text-center sm:p-10">
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-teal to-deep text-white shadow-xl">
          <Lock className="size-9" />
        </motion.div>
        <h1 className="font-display text-4xl font-bold">A rede agora é exclusiva para assinantes</h1>
        <p className="mt-3 text-ink-soft">
          O período aberto terminou em 15/01/2027. O mapa, os perfis e o chat do ConectaBC são reservados a donos de negócios com assinatura ativa de {PRICE_LABEL}/mês.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <LinkButton href="/cadastro" variant="primary" size="lg">Assinar e entrar na rede</LinkButton>
          <LinkButton href="/entrar" variant="outline" size="lg">Já sou membro</LinkButton>
        </div>
      </div>
    </Shell>
  );
}

/** Membro sem assinatura ativa após o lançamento. */
export function Paywall() {
  return (
    <Shell>
      <div className="conic-border rounded-[2rem]">
        <div className="card rounded-[2rem] p-8 text-center sm:p-10">
          <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-coral to-[#ffb36b] text-white shadow-xl">
            <Sparkles className="size-9" />
          </div>
          <h1 className="font-display text-4xl font-bold">Falta só ativar sua assinatura</h1>
          <p className="mt-3 text-ink-soft">
            O mapa, o diretório, as conversas e as parcerias são liberados para membros com assinatura ativa. Enquanto isso, seu negócio fica oculto para a rede —{" "}
            <strong className="text-ink">nenhum dado é apagado</strong>.
          </p>
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-ink-soft">
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-teal" /> Você ainda pode editar seu negócio e gerenciar o pagamento.</li>
            <li className="flex gap-2"><Store className="size-4 shrink-0 text-teal" /> Ao assinar, seu perfil volta a aparecer na hora.</li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <LinkButton href="/painel/assinatura" variant="primary" size="lg">Assinar por {PRICE_LABEL}/mês</LinkButton>
            <LinkButton href="/painel/meu-negocio" variant="outline" size="lg">Editar meu negócio</LinkButton>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function NeedsBusiness({ action = "conectar" }: { action?: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-coral/25 bg-gradient-to-r from-coral/10 to-sand/40 p-4 sm:flex-row sm:items-center dark:to-transparent">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral text-white">
        <Store className="size-5" />
      </div>
      <p className="flex-1 text-sm text-ink">
        <strong>Cadastre seu negócio para {action}.</strong> Leva dois minutos e você aparece no mapa para toda a rede.
      </p>
      <LinkButton href="/painel/meu-negocio" variant="primary" size="sm">Cadastrar meu negócio</LinkButton>
    </div>
  );
}
