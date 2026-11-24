"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, Clock, Handshake, Inbox, MessagesSquare, Send, Sparkles, X, Check, Info } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp, useDemoChanges } from "@/components/app/providers";
import { NeedsBusiness } from "@/components/app/gates";
import { backend } from "@/lib/backend";
import type { PartnershipsResult } from "@/lib/backend/types";
import type { Partnership, PartnershipStatus } from "@/lib/types";
import { partnershipType } from "@/lib/categories";
import { relativeDate } from "@/lib/format";
import { now } from "@/lib/clock";
import { Odometer } from "@/components/home/sections";
import { Button, LinkButton } from "@/components/ui/button";
import { Cover } from "@/components/ui/cover";
import { Empty, Pill, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { celebrate } from "@/components/partner/propose-modal";

const ease = [0.16, 1, 0.3, 1] as const;

export default function Page() {
  return (
    <RequireMember paywall>
      <Partnerships />
    </RequireMember>
  );
}

const STATUS: Record<PartnershipStatus, { label: string; tone: "warn" | "success" | "danger" | "default" }> = {
  pending: { label: "Pendente", tone: "warn" },
  accepted: { label: "Aceita", tone: "success" },
  declined: { label: "Recusada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "default" },
};

function Partnerships() {
  const { session } = useApp();
  const [data, setData] = useState<PartnershipsResult | null>(null);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [busy, setBusy] = useState<string | null>(null);
  const uid = session?.user?.id;

  const load = useCallback(() => {
    backend.listPartnerships().then(setData).catch((e) => toast.error("Erro ao carregar", e.message));
  }, []);
  useEffect(load, [load]);
  useDemoChanges(load);

  if (!session?.business)
    return (
      <main className="mx-auto max-w-3xl px-5 pt-[calc(var(--hh,96px)+2rem)]">
        <NeedsBusiness action="propor e receber parcerias" />
      </main>
    );

  const list = data?.partnerships ?? [];
  const received = list.filter((p) => p.recipientId === uid);
  const sent = list.filter((p) => p.requesterId === uid);
  const shown = tab === "received" ? received : sent;
  const stats = [
    { label: "Recebidas", v: received.length, icon: Inbox },
    { label: "Aguardando resposta", v: list.filter((p) => p.status === "pending").length, icon: Clock },
    { label: "Aceitas", v: list.filter((p) => p.status === "accepted").length, icon: Handshake },
  ];

  const act = async (p: Partnership, kind: "accept" | "decline" | "cancel", e: React.MouseEvent) => {
    setBusy(p.id + kind);
    try {
      if (kind === "cancel") await backend.cancel(p.id);
      else await backend.respond(p.id, kind === "accept");
      if (kind === "accept") {
        celebrate({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
        toast.success("Parceria aceita! 🤝", "Que tal combinar os detalhes pelo chat?");
      } else toast.info(kind === "decline" ? "Proposta recusada." : "Proposta cancelada.");
      load();
    } catch (err) {
      toast.error("Não foi possível concluir", (err as Error).message);
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-32 pt-[calc(var(--hh,96px)+2rem)] sm:px-8 lg:pb-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Parcerias</h1>
          <p className="mt-2 text-ink-soft">Propostas que você recebeu e enviou para outros negócios da rede.</p>
        </div>
        <LinkButton href="/explorar" variant="primary" icon={<Sparkles className="size-4" />}>Nova proposta</LinkButton>
      </motion.div>

      <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i + 0.1, duration: 0.8, ease }} className="card rounded-3xl p-4 sm:p-6">
            <s.icon className="size-5 text-teal" />
            <div className="font-display mt-4 text-4xl font-bold sm:text-5xl">{data ? <Odometer key={s.v} value={s.v} /> : <Skeleton className="h-10 w-12" />}</div>
            <p className="mt-1 text-xs text-ink-soft sm:text-sm">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 flex gap-1 rounded-full bg-surface-2 p-1 sm:inline-flex">
        {([["received", "Recebidas", received.length], ["sent", "Enviadas", sent.length]] as const).map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("relative flex-1 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors sm:flex-none", tab === k ? "text-ink" : "text-ink-faint hover:text-ink")}>
            {tab === k && <motion.span layoutId="ptab" className="absolute inset-0 rounded-full bg-surface shadow-[var(--shadow)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{l} <span className="text-ink-faint">{n}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {!data ? (
          <div className="space-y-4">{[0, 1].map((i) => <Skeleton key={i} className="h-44 !rounded-3xl" />)}</div>
        ) : shown.length === 0 ? (
          <div className="card rounded-3xl">
            <Empty
              icon={tab === "received" ? <Inbox className="size-8" /> : <Send className="size-8" />}
              title={tab === "received" ? "Nenhuma proposta recebida ainda" : "Você ainda não enviou propostas"}
              body={tab === "received" ? "Complete seu perfil com “parceiros que procura” e “benefício para parceiros” para atrair propostas." : "Encontre um negócio no mapa e toque em “Propor parceria”."}
              action={<LinkButton href={tab === "received" ? "/painel/meu-negocio" : "/explorar"} variant="outline">{tab === "received" ? "Completar perfil" : "Explorar o mapa"} <ArrowRight className="size-4" /></LinkButton>}
            />
          </div>
        ) : (
          <motion.ul layout className="space-y-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((p, i) => {
                const otherId = tab === "received" ? p.requesterBusinessId : p.recipientBusinessId;
                const other = data.businesses[otherId];
                const t = partnershipType(p.type);
                const st = STATUS[p.status];
                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.6, ease } }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={clsx("card overflow-hidden rounded-3xl", p.status === "accepted" && "ring-1 ring-teal/30")}
                  >
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
                      <Link href={`/negocio/${otherId}`} className="size-16 shrink-0 overflow-hidden rounded-2xl">
                        <Cover small name={other?.name ?? "?"} cat={other?.category ?? "outros"} url={other?.coverUrl} className="size-full" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/negocio/${otherId}`} className="font-display text-xl font-bold hover:underline">{other?.name ?? "Negócio"}</Link>
                          <motion.span key={p.status} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <Pill tone={st.tone}>{p.status === "accepted" && <Check className="size-3" />}{st.label}</Pill>
                          </motion.span>
                        </div>
                        <p className="mt-1 text-sm text-ink-faint">
                          {t.emoji} {t.label} · {tab === "received" ? "recebida" : "enviada"} {relativeDate(p.createdAt, now())}
                        </p>
                        <p className="mt-3 whitespace-pre-line text-ink-soft">{p.intro}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {tab === "received" && p.status === "pending" && (
                            <>
                              <Button size="sm" variant="brand" loading={busy === p.id + "accept"} onClick={(e) => act(p, "accept", e)} icon={<Check className="size-4" />}>Aceitar</Button>
                              <Button size="sm" variant="outline" loading={busy === p.id + "decline"} onClick={(e) => act(p, "decline", e)} icon={<X className="size-4" />}>Recusar</Button>
                            </>
                          )}
                          {tab === "sent" && p.status === "pending" && (
                            <Button size="sm" variant="danger" loading={busy === p.id + "cancel"} onClick={(e) => act(p, "cancel", e)}>Cancelar proposta</Button>
                          )}
                          <LinkButton size="sm" variant="ghost" href={`/painel/conversas/${otherId}`} icon={<MessagesSquare className="size-4" />}>Abrir conversa</LinkButton>
                          <LinkButton size="sm" variant="ghost" href={`/negocio/${otherId}`}>Ver perfil</LinkButton>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <p className="mt-10 flex gap-2 text-sm text-ink-faint">
        <Info className="mt-0.5 size-4 shrink-0" />
        Aceitar uma proposta confirma o interesse das duas partes. Campanhas de desconto e rastreamento de indicações estão planejados para uma próxima fase — por enquanto, os detalhes são combinados diretamente entre os negócios.
      </p>
    </main>
  );
}
