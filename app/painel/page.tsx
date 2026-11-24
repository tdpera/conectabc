"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Compass, Handshake, MessagesSquare, Store, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { RequireMember } from "@/components/app/require";
import { useApp, useDemoChanges } from "@/components/app/providers";
import { backend } from "@/lib/backend";
import type { Conversation } from "@/lib/types";
import type { DirectoryEntry, PartnershipsResult } from "@/lib/backend/types";
import { partnershipType } from "@/lib/categories";
import { timeLabel } from "@/lib/format";
import { Odometer, BusinessTile, TiltCard } from "@/components/home/sections";
import { Button, LinkButton } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/components/partner/propose-modal";
import { now } from "@/lib/clock";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Page() {
  return (
    <RequireMember paywall>
      <Dashboard />
    </RequireMember>
  );
}

function greeting() {
  const h = now().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function Dashboard() {
  const { session, refresh } = useApp();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [parts, setParts] = useState<PartnershipsResult | null>(null);
  const [latest, setLatest] = useState<DirectoryEntry[] | null>(null);
  const biz = session?.business;

  const load = useCallback(() => {
    backend.listConversations().then(setConvs).catch(() => setConvs([]));
    backend.listPartnerships().then(setParts).catch(() => setParts({ partnerships: [], businesses: {} }));
    backend.listDirectory().then((r) => setLatest([...r.businesses].filter((b) => b.id !== biz?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3))).catch(() => setLatest([]));
  }, [biz?.id]);
  useEffect(load, [load]);
  useDemoChanges(load);

  const uid = session?.user?.id;
  const received = parts?.partnerships.filter((p) => p.recipientId === uid && p.status === "pending") ?? [];
  const accepted = parts?.partnerships.filter((p) => p.status === "accepted").length ?? 0;
  const unread = convs?.reduce((n, c) => n + c.unread, 0) ?? 0;

  const steps = useMemo(
    () => [
      { done: true, label: "Criar sua conta" },
      { done: !!biz, label: "Cadastrar seu negócio", href: "/painel/meu-negocio" },
      { done: !!biz?.lat, label: "Marcar seu ponto no mapa", href: "/painel/meu-negocio#pin" },
      { done: (convs?.length ?? 0) > 0, label: "Começar uma conversa", href: "/explorar" },
      { done: (parts?.partnerships.length ?? 0) > 0, label: "Propor sua primeira parceria", href: "/explorar" },
    ],
    [biz, convs, parts],
  );
  const progress = steps.filter((s) => s.done).length / steps.length;

  const respond = async (id: string, accept: boolean, e: React.MouseEvent) => {
    try {
      await backend.respond(id, accept);
      if (accept) celebrate({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
      toast.success(accept ? "Parceria aceita! 🤝" : "Proposta recusada.");
      load();
      refresh();
    } catch (err) {
      toast.error("Não foi possível responder", (err as Error).message);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
        <p className="text-sm font-semibold text-ink-faint first-letter:uppercase">{now().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="font-display mt-1 text-4xl font-bold sm:text-5xl">
          {greeting()}, <span className="text-teal">{biz?.name ?? session?.user?.name}</span> 👋
        </h1>
      </motion.div>

      {progress < 1 && (
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease }} className="relative mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-deep via-teal to-[#16a3a0] p-6 text-white sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProgressRing value={progress} />
            <div className="flex-1">
              <p className="font-display text-2xl font-bold">{biz ? "Quase lá! Complete sua presença na rede" : "Primeiro passo: cadastre seu negócio"}</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {steps.map((s) => (
                  <li key={s.label}>
                    {s.href && !s.done ? (
                      <Link href={s.href} className="flex items-center gap-2 text-sm text-white hover:underline">
                        <span className="grid size-5 place-items-center rounded-full border border-white/50" /> {s.label} <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      <span className={clsx("flex items-center gap-2 text-sm", s.done ? "text-white/60 line-through" : "text-white")}>
                        <span className="grid size-5 place-items-center rounded-full bg-white text-teal"><Check className="size-3" /></span> {s.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {!biz && <LinkButton href="/painel/meu-negocio" variant="primary" size="lg" icon={<Store className="size-5" />}>Cadastrar meu negócio</LinkButton>}
          </div>
        </motion.section>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "mensagens não lidas", v: unread, icon: MessagesSquare, href: "/painel/conversas", tone: "from-aqua/20" },
          { label: "propostas aguardando você", v: received.length, icon: Sparkles, href: "/painel/parcerias", tone: "from-coral/20" },
          { label: "parcerias aceitas", v: accepted, icon: Handshake, href: "/painel/parcerias", tone: "from-sand" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08, duration: 0.8, ease }}>
            <Link href={s.href} className={clsx("card group block rounded-3xl bg-gradient-to-br to-transparent p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] dark:from-white/5", s.tone)}>
              <div className="flex items-start justify-between">
                <s.icon className="size-6 text-teal" />
                <ArrowRight className="size-4 -translate-x-2 text-ink-faint opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <div className="font-display mt-6 text-6xl font-bold">{convs && parts ? <Odometer value={s.v} /> : <Skeleton className="h-14 w-16" />}</div>
              <p className="mt-1 text-sm text-ink-soft">{s.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Propostas para você" href="/painel/parcerias" delay={0.3}>
          {!parts ? (
            <Skeleton className="h-28" />
          ) : received.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">Nenhuma proposta pendente. Que tal propor uma você? <Link href="/explorar" className="font-semibold text-teal">Explorar →</Link></p>
          ) : (
            <ul className="space-y-3">
              {received.slice(0, 3).map((p) => {
                const other = parts.businesses[p.requesterBusinessId];
                const t = partnershipType(p.type);
                return (
                  <li key={p.id} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 overflow-hidden rounded-xl"><Cover small name={other?.name ?? "?"} cat={other?.category ?? "outros"} className="size-full [&_span]:text-xl" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{other?.name}</p>
                        <p className="text-xs text-ink-faint">{t.emoji} {t.label}</p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{p.intro}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="brand" onClick={(e) => respond(p.id, true, e)}>Aceitar</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => respond(p.id, false, e)}>Recusar</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Conversas recentes" href="/painel/conversas" delay={0.38}>
          {!convs ? (
            <Skeleton className="h-28" />
          ) : convs.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">Nenhuma conversa ainda. Abra um perfil no mapa e toque em “Conversar”.</p>
          ) : (
            <ul className="-mx-2">
              {convs.slice(0, 4).map((c) => (
                <li key={c.business.id}>
                  <Link href={`/painel/conversas/${c.business.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
                    <div className="size-11 shrink-0 overflow-hidden rounded-full"><Cover small name={c.business.name} cat={c.business.category} className="size-full [&_span]:text-xl" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <p className={clsx("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.business.name}</p>
                        <span className="shrink-0 text-xs text-ink-faint">{timeLabel(c.lastMessage.createdAt, now())}</span>
                      </div>
                      <p className={clsx("truncate text-sm", c.unread ? "text-ink" : "text-ink-faint")}>{c.lastMessage.senderId === uid ? "Você: " : ""}{c.lastMessage.body}</p>
                    </div>
                    {c.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-coral text-[11px] font-bold text-white">{c.unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-3xl font-bold">Novos vizinhos</h2>
          <Link href="/explorar" className="flex items-center gap-1 text-sm font-semibold text-teal">
            <Compass className="size-4" /> Ver mapa
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {(latest ?? Array.from({ length: 3 }, () => null)).map((b, i) =>
            b ? (
              <motion.div key={b.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08, duration: 0.8, ease }}>
                <TiltCard className="h-full"><BusinessTile b={b} /></TiltCard>
              </motion.div>
            ) : (
              <Skeleton key={i} className="h-80 !rounded-[1.75rem]" />
            ),
          )}
        </div>
      </section>
    </main>
  );
}

function Panel({ title, href, children, delay }: { title: string; href: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.8, ease }} className="card rounded-[1.75rem] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-teal hover:underline">Ver tudo</Link>
      </div>
      {children}
    </motion.section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
        <circle cx="40" cy="40" r={r} stroke="rgba(255,255,255,.2)" strokeWidth="7" fill="none" />
        <motion.circle cx="40" cy="40" r={r} stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 1.6, delay: 0.4, ease }} />
      </svg>
      <span className="font-display text-2xl font-bold">{Math.round(value * 100)}%</span>
    </div>
  );
}

