"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Circle, Download, Handshake, MessagesSquare, RefreshCw, Rocket, Search, Shield, Store, TrendingUp, UserPlus, Users } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { backend } from "@/lib/backend";
import type { AdminRow, AdminStats, SubscriptionStatus } from "@/lib/types";
import { tally, toCsv, weekly } from "@/lib/admin";
import { now as clockNow } from "@/lib/clock";
import { CATEGORIES, category } from "@/lib/categories";
import { instagramLink, money, normalize, relativeDate, websiteLink, whatsappLink } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
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

  const [has, setHas] = useState("");
  const [open, setOpen] = useState<AdminRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      setS(await backend.adminStats());
      setAt(new Date());
    } catch (e) {
      if (!quiet) toast.error("Erro", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(true), 60000);
    return () => clearInterval(t);
  }, [load]);

  const weeks = useMemo(() => weekly((s?.rows ?? []).map((x) => x.joinedAt), clockNow()), [s]);
  const cats = useMemo(() => tally((s?.rows ?? []).flatMap((x) => (x.business ? [x.business.category] : []))), [s]);
  const hoods = useMemo(() => tally((s?.rows ?? []).flatMap((x) => (x.business ? [x.business.neighborhood || "Sem bairro"] : []))), [s]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `conectabc-empresas-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const rows = useMemo(() => {
    const nq = normalize(q);
    return (s?.rows ?? []).filter(
      (r) =>
        (!cat || r.business?.category === cat) && (!st || r.subscription === st) && (!has || (has === "sim") === !!r.business) &&
        (!nq || normalize(`${r.business?.name ?? ""} ${r.business?.description ?? ""} ${r.ownerName} ${r.ownerEmail} ${r.business?.neighborhood ?? ""}`).includes(nq)),
    );
  }, [s, q, cat, st, has]);

  const kpis = [
    { label: "Contas criadas", v: s?.totalAccounts ?? 0, icon: UserPlus },
    { label: "Negócios cadastrados", v: s?.totalBusinesses ?? 0, icon: Store },
    { label: "Assinantes ativos", v: s?.activeSubscribers ?? 0, icon: Users },
    { label: "Vagas grátis usadas (de 100)", v: s?.foundersUsed ?? 0, icon: Rocket },
    { label: "Entraram por indicação", v: s?.referredBusinesses ?? 0, icon: UserPlus },
    { label: "Parcerias fechadas", v: s?.partnershipsAccepted ?? 0, icon: Handshake },
    { label: "Propostas em aberto", v: s?.partnershipsPending ?? 0, icon: Handshake },
    { label: "Mensagens trocadas", v: s?.messages ?? 0, icon: MessagesSquare },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-brand-ink"><Shield className="size-4" /> Administração</p>
          <h1 className="font-display mt-1 text-4xl font-bold sm:text-5xl">Visão geral</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {at && <span className="mr-1 text-xs text-ink-faint">Atualizado às {at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
        <button onClick={() => load()} disabled={busy} className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60">
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> Atualizar
        </button>
        <Link href="/admin/stripe-guia" className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2">
          <BookOpen className="size-4" /> Guia de configuração do Stripe
        </Link>
        </div>
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
          <p className="mt-2 text-[11px] text-white/60">Projeção simples: (ativos + cartões cadastrados) × R$ 49,99. Não considera descontos, impostos, taxas ou inadimplência.</p>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Novos cadastros por semana" sub="Últimas 12 semanas"><Weeks data={weeks} /></Panel>
        <Panel title="Por categoria" sub="Negócios cadastrados"><Bars data={cats.map((c) => ({ label: `${category(c.key).emoji} ${category(c.key).label}`, count: c.count }))} /></Panel>
        <Panel title="Por bairro" sub="Negócios cadastrados"><Bars data={hoods.map((h) => ({ label: h.key, count: h.count }))} /></Panel>
      </div>

      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8, ease }} className="card mt-6 overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="font-display mr-auto text-xl font-bold">Empresas e contas <span className="text-ink-faint">{rows.length}</span></h2>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-10 rounded-full border border-line bg-bg pl-9 pr-4 text-sm outline-none focus:border-teal" aria-label="Buscar negócio" />
          </label>
          <select value={has} onChange={(e) => setHas(e.target.value)} className="h-10 rounded-full border border-line bg-bg px-3 text-sm" aria-label="Filtrar por cadastro do negócio">
            <option value="">Todas as contas</option>
            <option value="sim">Com negócio</option>
            <option value="nao">Sem negócio ainda</option>
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 rounded-full border border-line bg-bg px-3 text-sm" aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={st} onChange={(e) => setSt(e.target.value)} className="h-10 rounded-full border border-line bg-bg px-3 text-sm" aria-label="Filtrar por assinatura">
            <option value="">Todas as assinaturas</option>
            {(Object.keys(STATUS_INFO) as SubscriptionStatus[]).map((k) => <option key={k} value={k}>{STATUS_INFO[k].label}</option>)}
          </select>
          <button onClick={download} disabled={!rows.length} className="flex h-10 items-center gap-2 rounded-full border border-line bg-bg px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50">
            <Download className="size-4" /> CSV
          </button>
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
                    <motion.tr key={r.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="border-t border-line hover:bg-surface-2/60">
                      <td className="max-w-[320px] px-4 py-3">
                        {r.business ? (
                          <>
                            <button onClick={() => setOpen(r)} className="text-left font-semibold hover:text-teal">{category(r.business.category).emoji} {r.business.name}</button>
                            <p className="truncate text-xs text-ink-faint">{category(r.business.category).label}{r.business.description && ` · ${r.business.description}`}</p>
                          </>
                        ) : <span className="text-ink-faint">Sem negócio ainda</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft"><span className="block">{r.ownerName || "—"}</span><span className="text-xs text-ink-faint">{r.ownerEmail}</span></td>
                      <td className="px-4 py-3 text-ink-soft">{r.business?.neighborhood || "—"}</td>
                      <td className="px-4 py-3">{r.business && r.business.lat !== null ? "📍" : <span className="text-ink-faint">—</span>}</td>
                      <td className="px-4 py-3 text-ink-soft">{r.joinedAt ? relativeDate(r.joinedAt, clockNow()) : "—"}</td>
                      <td className="px-4 py-3">{r.freeActive && r.subscription === "none" ? <Pill tone="success">Mês grátis</Pill> : <Pill tone={STATUS_INFO[r.subscription].tone}>{STATUS_INFO[r.subscription].label}</Pill>}</td>
                    </motion.tr>
                  ))}
              {s && !rows.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-faint">{s.rows.length ? "Nada encontrado com esses filtros." : "Nenhuma empresa cadastrada ainda."}</td></tr>}
            </tbody>
          </table>
        </div>
      </motion.section>

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

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.business?.name ?? ""} wide>{open?.business && <Details row={open} />}</Modal>
    </main>
  );
}


function Panel({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="card rounded-3xl p-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="text-xs text-ink-faint">{sub}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const dm = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function Weeks({ data }: { data: ReturnType<typeof weekly> }) {
  const [hot, setHot] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const shown = hot === null ? null : data[hot];
  return (
    <div>
      <p className="mb-2 h-5 text-sm text-ink-soft" aria-live="polite">
        {shown ? <><strong className="text-ink">{shown.count}</strong> entre {dm(shown.start)} e {dm(shown.end)}</> : <><strong className="text-ink">{data.at(-1)?.count ?? 0}</strong> nos últimos 7 dias</>}
      </p>
      <div className="flex h-36 items-end border-b border-line" onMouseLeave={() => setHot(null)}>
        {data.map((d, i) => (
          <button key={i} type="button" onMouseEnter={() => setHot(i)} onFocus={() => setHot(i)} onBlur={() => setHot(null)} className="flex h-full flex-1 items-end justify-center px-px outline-offset-[-2px]" aria-label={`${d.count} cadastros entre ${dm(d.start)} e ${dm(d.end)}`}>
            <span className={`w-full max-w-6 rounded-t bg-teal transition-opacity dark:bg-aqua ${hot !== null && hot !== i ? "opacity-40" : ""}`} style={{ height: d.count ? `max(4px, ${(d.count / max) * 100}%)` : 0 }} />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-faint"><span>{data[0] && dm(data[0].start)}</span><span>hoje</span></div>
    </div>
  );
}

function Bars({ data }: { data: { label: string; count: number }[] }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-ink-faint">Sem dados ainda.</p>;
  const top = data.slice(0, 7);
  const rest = data.slice(7).reduce((n, d) => n + d.count, 0);
  const list = rest ? [...top, { label: "Demais", count: rest }] : top;
  const max = Math.max(...list.map((d) => d.count));
  return (
    <ul className="grid gap-2">
      {list.map((d) => (
        <li key={d.label} title={`${d.label}: ${d.count}`} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2rem] items-center gap-2 text-sm">
          <span className="truncate text-ink-soft">{d.label}</span>
          <span className="h-3"><span className="block h-full rounded-r bg-teal dark:bg-aqua" style={{ width: `${(d.count / max) * 100}%` }} /></span>
          <span className="text-right font-semibold tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Details({ row }: { row: AdminRow }) {
  const b = row.business!;
  const link = (href: string, text: string) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal underline-offset-2 hover:underline">{text}</a>;
  const items: [string, ReactNode][] = [
    ["Categoria", `${category(b.category).emoji} ${category(b.category).label}`],
    ["Dono", row.ownerName],
    ["E-mail", row.ownerEmail],
    ["Telefone", b.phone],
    ["WhatsApp", b.whatsapp && link(whatsappLink(b.whatsapp), b.whatsapp)],
    ["Instagram", b.instagram && link(instagramLink(b.instagram), b.instagram)],
    ["Site", b.website && link(websiteLink(b.website), b.website)],
    ["Endereço", [b.address, b.neighborhood, b.city, b.state].filter(Boolean).join(", ")],
    ["Horário", b.hours],
    ["Entrou", row.joinedAt && new Date(row.joinedAt).toLocaleDateString("pt-BR")],
    ["Assinatura", STATUS_INFO[row.subscription].label],
    ["Vaga gratuita", row.membership?.founderNumber && `nº ${row.membership.founderNumber}, até ${new Date(row.membership.freeUntil!).toLocaleDateString("pt-BR")}`],
    ["Código de indicação", row.membership?.referralCode],
    ["Entrou com o código", row.membership?.referredCode],
    ["Negócios que indicou", row.referrals || null],
    ["Parceiros ideais", b.idealPartners],
    ["Oferece", b.partnerOffer],
  ];
  return (
    <div>
      {b.description && <p className="whitespace-pre-line text-ink-soft">{b.description}</p>}
      <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.filter(([, v]) => v).map(([k, v]) => (
          <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{k}</dt><dd className="break-words text-sm">{v}</dd></div>
        ))}
      </dl>
      <Link href={`/negocio/${b.id}`} className="mt-6 inline-block rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">Ver perfil na rede</Link>
    </div>
  );
}
