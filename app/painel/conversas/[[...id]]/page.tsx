"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { ArrowLeft, CheckCheck, Check, Lock, MessagesSquare, Search, SendHorizontal, Store } from "lucide-react";
import { RequireMember } from "@/components/app/require";
import { useApp, useDemoChanges } from "@/components/app/providers";
import { NeedsBusiness } from "@/components/app/gates";
import { backend } from "@/lib/backend";
import type { Conversation, Message, PublicBusiness } from "@/lib/types";
import type { DirectoryEntry } from "@/lib/backend/types";
import { category } from "@/lib/categories";
import { normalize, timeLabel } from "@/lib/format";
import { now } from "@/lib/clock";
import { Cover } from "@/components/ui/cover";
import { Empty, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";

const POLL_MS = 15_000;

export default function Page() {
  return (
    <RequireMember paywall>
      <Chat />
    </RequireMember>
  );
}

/** Executa `fn` a cada 15s enquanto a aba está visível (polling, não push). */
function usePolling(fn: () => void, ms = POLL_MS) {
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!t) t = setInterval(fn, ms);
    };
    const stop = () => {
      if (t) clearInterval(t);
      t = null;
    };
    const vis = () => {
      if (document.hidden) stop();
      else {
        fn();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [fn, ms]);
}

function Chat() {
  const { session } = useApp();
  const params = useParams<{ id?: string[] }>();
  const otherId = params.id?.[0] ?? null;
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [q, setQ] = useState("");

  const loadConvs = useCallback(() => {
    backend.listConversations().then(setConvs).catch(() => setConvs([]));
  }, []);
  useEffect(loadConvs, [loadConvs, otherId]);
  usePolling(loadConvs);
  useDemoChanges(loadConvs);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return (convs ?? []).filter((c) => !nq || normalize(c.business.name + " " + c.lastMessage.body).includes(nq));
  }, [convs, q]);

  if (!session?.business)
    return (
      <main className="mx-auto max-w-3xl px-5 pt-[calc(var(--hh,96px)+2rem)]">
        <NeedsBusiness action="conversar com outros negócios" />
      </main>
    );

  return (
    <main className="fixed inset-x-0 bottom-0 top-[var(--hh,96px)] flex max-lg:bottom-[5.5rem]">
      <aside className={clsx("flex w-full flex-col border-r border-line bg-bg lg:w-[380px] lg:shrink-0", otherId && "max-lg:hidden")}>
        <div className="space-y-3 p-4">
          <h1 className="font-display text-2xl font-bold">Conversas</h1>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa" className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-teal focus:ring-4 focus:ring-aqua/20" aria-label="Buscar conversa" />
          </label>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-2 pb-4">
          {!convs ? (
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-3 p-2.5">
                <Skeleton className="size-12 shrink-0 !rounded-full" />
                <div className="flex-1 space-y-2 py-1"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-4/5" /></div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <Empty icon={<MessagesSquare className="size-8" />} title={q ? "Nada encontrado" : "Nenhuma conversa"} body={q ? undefined : "Abra um negócio no mapa e toque em “Conversar”."} action={!q && <Link href="/explorar" className="font-semibold text-teal">Explorar o mapa →</Link>} />
          ) : (
            <motion.ul layout>
              {filtered.map((c) => (
                <motion.li key={c.business.id} layout transition={{ type: "spring", stiffness: 400, damping: 36 }}>
                  <Link
                    href={`/painel/conversas/${c.business.id}`}
                    className={clsx("relative flex items-center gap-3 rounded-2xl p-2.5 transition-colors", c.business.id === otherId ? "bg-surface shadow-[var(--shadow)]" : "hover:bg-surface/70")}
                  >
                    {c.business.id === otherId && <motion.span layoutId="conv-bar" className="absolute inset-y-3 left-0 w-1 rounded-full bg-teal" />}
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-full">
                      <Cover small name={c.business.name} cat={c.business.category} url={c.business.coverUrl} className="size-full [&_span]:text-2xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={clsx("truncate", c.unread ? "font-bold text-ink" : "font-semibold text-ink")}>{c.business.name}</p>
                        <span className={clsx("shrink-0 text-xs", c.unread ? "font-semibold text-teal" : "text-ink-faint")}>{timeLabel(c.lastMessage.createdAt, now())}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={clsx("flex-1 truncate text-sm", c.unread ? "text-ink" : "text-ink-faint")}>
                          {c.lastMessage.senderId === session.user!.id && "Você: "}
                          {c.lastMessage.body}
                        </p>
                        <AnimatePresence>
                          {c.unread > 0 && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[11px] font-bold text-white">
                              {c.unread}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </aside>

      <section className={clsx("relative flex flex-1 flex-col bg-surface-2/60", !otherId && "max-lg:hidden")}>
        {otherId ? (
          <Thread key={otherId} otherId={otherId} known={convs?.find((c) => c.business.id === otherId)?.business} onSent={loadConvs} />
        ) : (
          <div className="grid flex-1 place-items-center">
            <Empty icon="💬" title="Escolha uma conversa" body="Suas conversas com outros negócios aparecem aqui. Tudo fica entre os estabelecimentos." />
          </div>
        )}
      </section>
    </main>
  );
}

const SUGGESTIONS = [
  "Olá! Vi seu perfil no ConectaBC e acho que nossos negócios combinam. Podemos conversar?",
  "Oi! Que tal trocarmos indicações de clientes?",
  "Olá! Tenho interesse no benefício para parceiros que vocês oferecem.",
];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = now();
  const diff = Math.round((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function Thread({ otherId, known, onSent }: { otherId: string; known?: PublicBusiness; onSent: () => void }) {
  const { session } = useApp();
  const router = useRouter();
  const [other, setOther] = useState<DirectoryEntry | PublicBusiness | null | undefined>(known);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [pending, setPending] = useState<{ id: string; body: string }[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const uid = session!.user!.id;

  useEffect(() => {
    if (!known) backend.getBusiness(otherId).then(setOther).catch(() => setOther(null));
  }, [otherId, known]);

  const load = useCallback(() => {
    backend
      .getThread(otherId)
      .then((m) => {
        setMsgs(m);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [otherId]);
  useEffect(load, [load]);
  usePolling(load);
  useDemoChanges(load);

  const count = (msgs?.length ?? 0) + pending.length;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: count > 0 && msgs ? "smooth" : "auto" });
  }, [count, msgs]);

  const send = async (body = text) => {
    const t = body.trim();
    if (!t) return;
    if (t.length > 2000) return toast.error("Mensagem muito longa", "O limite é de 2.000 caracteres.");
    const tmp = { id: "tmp-" + Date.now(), body: t };
    setPending((p) => [...p, tmp]);
    setText("");
    input.current?.focus();
    try {
      await backend.sendMessage(otherId, t);
      load();
      onSent();
    } catch (e) {
      toast.error("Mensagem não enviada", (e as Error).message);
      setText(t);
    } finally {
      setPending((p) => p.filter((x) => x.id !== tmp.id));
    }
  };

  const groups = useMemo(() => {
    const out: { day: string; items: Message[] }[] = [];
    for (const m of msgs ?? []) {
      const d = dayLabel(m.createdAt);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [msgs]);

  if (other === null)
    return (
      <div className="grid flex-1 place-items-center">
        <Empty icon={<Store className="size-8" />} title="Negócio indisponível" body="Este negócio não está disponível na rede no momento." />
      </div>
    );

  const c = other ? category(other.category) : null;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line bg-surface/80 px-3 py-3 backdrop-blur sm:px-5">
        <button className="grid size-9 place-items-center rounded-full hover:bg-surface-2 lg:hidden" onClick={() => router.push("/painel/conversas")} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </button>
        {other ? (
          <Link href={`/negocio/${other.id}`} className="flex min-w-0 items-center gap-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-full"><Cover small name={other.name} cat={other.category} url={other.coverUrl} className="size-full [&_span]:text-xl" /></div>
            <div className="min-w-0">
              <p className="truncate font-semibold hover:underline">{other.name}</p>
              <p className="flex items-center gap-1 text-xs text-teal"><Lock className="size-3" /> conversa privada entre estabelecimentos</p>
            </div>
          </Link>
        ) : (
          <Skeleton className="h-10 w-56" />
        )}
        {c && <span className="ml-auto hidden rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-soft sm:inline">{c.emoji} {c.label}</span>}
      </header>

      <div ref={scroller} className="thin-scroll flex-1 overflow-y-auto px-3 py-5 sm:px-6">
        {!msgs && !error ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
          </div>
        ) : error ? (
          <Empty icon="⚠️" title="Não foi possível abrir a conversa" body={error} />
        ) : msgs!.length === 0 && pending.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md pt-10 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-aqua/30 to-teal/10 text-3xl">👋</div>
            <p className="font-display text-2xl font-bold">Diga olá para {other?.name}</p>
            <p className="mt-2 text-sm text-ink-soft">Comece com uma das sugestões ou escreva do seu jeito.</p>
            <div className="mt-5 space-y-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-left text-sm transition hover:border-teal/40 hover:shadow-[var(--shadow)]">
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {groups.map((g) => (
              <div key={g.day}>
                <div className="sticky top-0 z-10 my-4 flex justify-center">
                  <span className="glass rounded-full px-3 py-1 text-[11px] font-semibold text-ink-soft first-letter:uppercase">{g.day}</span>
                </div>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {g.items.map((m, i) => {
                      const mine = m.senderId === uid;
                      const next = g.items[i + 1];
                      const tail = !next || next.senderId !== m.senderId;
                      return (
                        <motion.li
                          key={m.id}
                          layout="position"
                          initial={{ opacity: 0, y: 18, x: mine ? 24 : -24, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 420, damping: 30 }}
                          className={clsx("flex", mine ? "justify-end" : "justify-start", tail && "mb-3")}
                        >
                          <Bubble mine={mine} tail={tail} body={m.body} time={m.createdAt} read={!!m.readAt} />
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
            <ul className="space-y-1.5">
              <AnimatePresence>
                {pending.map((p) => (
                  <motion.li key={p.id} initial={{ opacity: 0, y: 40, scale: 0.85 }} animate={{ opacity: 0.7, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="flex justify-end">
                    <Bubble mine tail body={p.body} sending />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-line bg-surface/90 p-3 backdrop-blur sm:p-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Escreva uma mensagem…"
              className="max-h-40 min-h-12 w-full resize-none rounded-3xl border border-line bg-bg px-5 py-3 pr-16 text-[15px] outline-none [field-sizing:content] focus:border-teal focus:ring-4 focus:ring-aqua/20"
              aria-label="Mensagem"
            />
            {text.length > 1500 && <span className={clsx("absolute bottom-3.5 right-4 text-xs", text.length >= 2000 ? "text-coral-deep" : "text-ink-faint")}>{text.length}/2000</span>}
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            type="submit"
            disabled={!text.trim()}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-teal text-white shadow-[0_8px_20px_-8px_rgba(15,139,141,0.9)] transition hover:bg-deep disabled:opacity-40"
            aria-label="Enviar"
          >
            <SendHorizontal className="size-5" />
          </motion.button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl px-2 text-[11px] text-ink-faint">Enter envia · Shift+Enter quebra linha · novas mensagens chegam em até 15 segundos</p>
      </form>
    </>
  );
}

function Bubble({ mine, tail, body, time, read, sending }: { mine: boolean; tail: boolean; body: string; time?: string; read?: boolean; sending?: boolean }) {
  return (
    <div
      className={clsx(
        "max-w-[min(78%,34rem)] px-4 py-2.5 text-[15px] leading-snug shadow-sm",
        mine ? "rounded-3xl bg-gradient-to-br from-teal to-[#0c7a7c] text-white" : "rounded-3xl bg-surface text-ink",
        tail && (mine ? "rounded-br-lg" : "rounded-bl-lg"),
      )}
    >
      <p className="whitespace-pre-wrap break-words">{body}</p>
      <p className={clsx("mt-1 flex items-center justify-end gap-1 text-[10.5px]", mine ? "text-white/70" : "text-ink-faint")}>
        {sending ? "enviando…" : time && new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        {mine && !sending && (read ? <CheckCheck className="size-3.5 text-aqua" aria-label="lida" /> : <Check className="size-3.5" aria-label="enviada" />)}
      </p>
    </div>
  );
}
