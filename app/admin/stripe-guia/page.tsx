"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Copy } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { toast } from "@/components/ui/toast";

const ease = [0.16, 1, 0.3, 1] as const;
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
];

export default function Page() {
  const [origin, setOrigin] = useState("https://seu-dominio.com.br");
  useEffect(() => setOrigin(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin), []);
  const hook = `${origin}/api/stripe/webhook`;
  const steps: [string, React.ReactNode][] = [
    ["Crie o produto e o preço", <>No painel do Stripe, crie o produto <strong>ConectaBC · Membro</strong> com preço recorrente <strong>mensal</strong> de <strong>R$ 49,99 (BRL)</strong>. Copie o ID do preço (<code>price_…</code>) para <code>STRIPE_PRICE_ID</code>.</>],
    ["Copie a chave secreta", <>Em Desenvolvedores → Chaves de API, copie a chave secreta (<code>sk_test_…</code> para testes, <code>sk_live_…</code> em produção) para <code>STRIPE_SECRET_KEY</code>.</>],
    ["Cadastre o webhook", <>Em Desenvolvedores → Webhooks, adicione o endpoint abaixo e selecione os eventos listados. Copie o segredo de assinatura (<code>whsec_…</code>) para <code>STRIPE_WEBHOOK_SECRET</code>.</>],
    ["Ative o portal do cliente", <>Em Configurações → Billing → Portal do cliente, permita atualizar a forma de pagamento e cancelar assinaturas.</>],
    ["Defina a URL pública", <>Configure <code>NEXT_PUBLIC_SITE_URL</code> com o endereço publicado (ex.: <code>https://conectabc.com.br</code>) e publique novamente.</>],
    ["Teste de ponta a ponta", <>Use o cartão de teste <code>4242 4242 4242 4242</code>, confira o status em Assinatura e o painel administrativo, depois troque para as chaves de produção.</>],
  ];
  return (
    <RequireMember admin>
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal"><ArrowLeft className="size-4" /> Administração</Link>
        <h1 className="font-display mt-3 text-4xl font-bold">Configurar o Stripe</h1>
        <p className="mt-2 text-ink-soft">Passo a passo para receber as assinaturas de R$ 49,99/mês.</p>

        <div className="card mt-8 rounded-3xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Endereço do webhook</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 font-mono text-sm">{hook}</code>
            <button onClick={() => navigator.clipboard.writeText(hook).then(() => toast.success("Copiado!"))} className="grid size-10 place-items-center rounded-xl border border-line hover:bg-surface-2" aria-label="Copiar"><Copy className="size-4" /></button>
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-ink-faint">Eventos</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{EVENTS.map((e) => <code key={e} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{e}</code>)}</div>
        </div>

        <ol className="relative mt-10 space-y-6 border-l-2 border-dashed border-line pl-8">
          {steps.map(([t, body], i) => (
            <motion.li key={t} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.6, ease }} className="relative">
              <span className="font-display absolute -left-[3.05rem] grid size-9 place-items-center rounded-full bg-teal font-bold text-white ring-4 ring-bg">{i + 1}</span>
              <h2 className="font-display text-xl font-bold">{t}</h2>
              <p className="mt-1 text-ink-soft [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]">{body}</p>
            </motion.li>
          ))}
        </ol>
      </main>
    </RequireMember>
  );
}
