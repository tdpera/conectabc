"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Circle, Search, Shield, TrendingUp, Users, Store, Rocket } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { backend } from "@/lib/backend";
import type { AdminStats, SubscriptionStatus } from "@/lib/types";
import { CATEGORIES, category } from "@/lib/categories";
import { money, normalize, relativeDate } from "@/lib/format";
import { STATUS_INFO } from "@/lib/subscription-status";
import { Odometer } from "@/components/home/sections";
import { Pill, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Page() {
  return (
    <RequireMember admin>
      <Admin />
    </RequireMember>
  );
}

function Admin() {
  const [s, setS] = useState<AdminStats | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [st, setSt] = useState("");

  useEffect(() => {
    backend.adminStats().then(setS).catch((e) => toast.error("Erro", e.message));
  }, []);

  const rows = useMemo(() => {
    const nq = normalize(q);
    return (s?.rows ?? []).filter(
      (r) => (!cat || r.business.category === cat) && (!st || r.subscription === st) && (!nq || normalize(`${r.business.name} ${r.ownerEmail} ${r.business.neighborhood}`).includes(nq)),
    );
  }, [s, q, cat, st]);

  const kpis = [
    { label: "Negócios cadastrados", v: s?.totalBusinesses ?? 0, icon: Store },
    { label: "Assinantes ativos", v: s?.activeSubscribers ?? 0, icon: Users },
    { label: "Cadastros antecipados", v: s?.earlyRegistrations ?? 0, icon: Rocket },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-ink"><Shield className="size-4" /> Administração</p>
          <h1 className="font-display mt-1 text-4xl font-bold sm:text-5xl">Visão geral</h1>
        </div>
        <Link href="/admin/stripe-guia" className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2">
          <BookOpen className="size-4" /> Guia de configuração do Stripe
        </Link>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i + 0.1, duration: 0.8, ease }} className="card rounded-3xl p-6">
            <k.icon className="size-5 text-teal" />
            <div className="font-display mt-4 text-5xl font-bold">{s ? <Odometer value={k.v} /> : <Skeleton className="h-12 w-16" />}</div>
            <p className="mt-1 text-sm text-ink-soft">{k.label}</p>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.8, ease }} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-deep to-teal p-6 text-white">
          <TrendingUp className="size-5" />
          <p className="font-display mt-4 text-4xl font-bold">{s ? money(s.projectedMrr) : "—"}</p>
          <p className="mt-1 text-sm text-white/75">Receita mensal projetada</p>
          <p className="mt-2 text-[11px] text-white/60">Projeção simples: (ativos + antecipados) × R$ 49,99. Não considera impostos, taxas ou inadimplência.</p>
        </motion.div>
      </div>

      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34, duration: 0.8, ease }} className="card mt-6 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Configuração do Stripe</h2>
          {s && <Pill tone={s.mode === "live" ? "success" : s.mode === "test" ? "info" : "warn"}>{s.mode === "live" ? "Modo produção" : s.mode === "test" ? "Modo teste" : "Não configurado"}</Pill>}
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(s?.config ?? []).map((c) => (
            <li key={c.key} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
              {c.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" /> : <Circle className="mt-0.5 size-5 shrink-0 text-ink-faint" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="truncate font-mono text-[11px] text-ink-faint">{c.detail ?? c.key}</p>
              </div>
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8, ease }} className="card mt-6 overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="font-display mr-auto text-xl font-bold">Negócios <span className="text-ink-faint">{rows.length}</span></h2>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-10 rounded-full border border-line bg-bg pl-9 pr-4 text-sm outline-none focus:border-teal" aria-label="Buscar negócio" />
          </label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-full border border-line bg-bg px-3 text-sm" aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={st} onChange={(e) => setSt(e.target.value)} className="h-10 rounded-full border border-line bg-bg px-3 text-sm" aria-label="Filtrar por assinatura">
            <option value="">Todas as assinaturas</option>
            {(Object.keys(STATUS_INFO) as SubscriptionStatus[]).map((k) => <option key={k} value={k}>{STATUS_INFO[k].label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-semibold">Negócio</th>
                <th className="px-4 py-3 font-semibold">Dono</th>
                <th className="px-4 py-3 font-semibold">Bairro</th>
                <th className="px-4 py-3 font-semibold">Pin</th>
                <th className="px-4 py-3 font-semibold">Entrou</th>
                <th className="px-4 py-3 font-semibold">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {!s
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-6" /></td></tr>
                  ))
                : rows.map((r, i) => (
                    <motion.tr key={r.business.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="border-t border-line hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <Link href={`/negocio/${r.business.id}`} className="font-semibold hover:text-teal">{category(r.business.category).emoji} {r.business.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{r.ownerEmail}</td>
                      <td className="px-4 py-3 text-ink-soft">{r.business.neighborhood || "—"}</td>
                      <td className="px-4 py-3">{r.business.lat !== null ? "📍" : <span className="text-ink-faint">—</span>}</td>
                      <td className="px-4 py-3 text-ink-soft">{relativeDate(r.business.createdAt)}</td>
                      <td className="px-4 py-3"><Pill tone={STATUS_INFO[r.subscription].tone}>{STATUS_INFO[r.subscription].label}</Pill></td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
        </div>
      </motion.section>
    </main>
  );
}

