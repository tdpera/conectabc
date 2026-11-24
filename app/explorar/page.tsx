"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, List, LocateFixed, Map as MapIcon, MapPinOff, Search, X } from "lucide-react";
import { backend } from "@/lib/backend";
import type { DirectoryEntry, DirectoryResult } from "@/lib/backend/types";
import { CATEGORIES, category } from "@/lib/categories";
import { formatDistance, haversine } from "@/lib/geo";
import { normalize } from "@/lib/format";
import { useApp } from "@/components/app/providers";
import { LockScreen, NeedsBusiness, Paywall } from "@/components/app/gates";
import { Cover } from "@/components/ui/cover";
import { Empty, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => <div className="skeleton size-full !rounded-none" />,
});

export default function ExplorePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const { session, loading, launched } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<DirectoryResult | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [view, setView] = useState<"map" | "list">("list");
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) return;
    backend.listDirectory().then(setData).catch((e) => toast.error("Não foi possível carregar o mapa", e.message));
  }, [loading, session?.user?.id, launched, session?.entitled]);

  // Volta de "Meu negócio" com ?salvo=1
  useEffect(() => {
    if (params.get("salvo") && data && session?.business) {
      toast.success("Negócio salvo!", session.business.lat ? "Seu pin já está no mapa." : "Marque seu ponto no mapa para aparecer aqui.");
      const b = session.business;
      if (b.lat && b.lng) {
        setActive(b.id);
        setFocus({ lat: b.lat, lng: b.lng, key: Date.now() });
      }
      router.replace("/explorar");
    }
  }, [params, data, session?.business, router]);

  const list = useMemo(() => {
    const all = data?.businesses ?? [];
    const nq = normalize(q.trim());
    let out = all.filter((b) => (!cat || b.category === cat) && (!nq || normalize([b.name, category(b.category).label, b.neighborhood, b.city, b.description].join(" ")).includes(nq)));
    if (me) {
      out = out
        .map((b) => ({ b, d: b.lat !== null && b.lng !== null ? haversine(me, { lat: b.lat, lng: b.lng }) : Infinity }))
        .sort((x, y) => x.d - y.d)
        .map((x) => x.b);
    } else {
      out = [...out].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return out;
  }, [data, q, cat, me]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of data?.businesses ?? []) m[b.category] = (m[b.category] ?? 0) + 1;
    return m;
  }, [data]);

  const locate = () => {
    if (me) {
      setMe(null);
      return;
    }
    if (!("geolocation" in navigator)) return toast.error("Seu navegador não permite localização.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
        toast.success("Ordenado por distância", "Os negócios mais próximos de você aparecem primeiro.");
      },
      () => {
        setLocating(false);
        toast.error("Não conseguimos sua localização", "Verifique a permissão de localização do navegador.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onHover = useCallback((b: DirectoryEntry | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHover(b?.id ?? null);
    if (!b || b.lat === null || b.lng === null) return;
    hoverTimer.current = setTimeout(() => setFocus({ lat: b.lat!, lng: b.lng!, key: Date.now() }), 280);
  }, []);

  if (!loading && data?.locked) return <LockScreen />;
  if (!loading && data?.paywalled) return <Paywall />;

  const ready = !!data && !loading;
  const isMember = !!session?.user;

  return (
    <main className="fixed inset-x-0 bottom-0 top-[var(--hh,96px)] flex">
      {/* Lista */}
      <section
        className={clsx(
          "flex w-full flex-col border-r border-line bg-bg lg:w-[440px] lg:shrink-0",
          view === "map" && "max-lg:hidden",
        )}
      >
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold">Explorar</h1>
            <span className="text-sm text-ink-faint">
              {ready ? (
                <motion.span key={list.length} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  {list.length} {list.length === 1 ? "negócio" : "negócios"}
                </motion.span>
              ) : (
                "carregando…"
              )}
            </span>
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar nome, segmento, bairro…"
                className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-9 text-sm outline-none transition focus:border-teal focus:ring-4 focus:ring-aqua/20"
                aria-label="Buscar negócios"
              />
              {q && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink" onClick={() => setQ("")} aria-label="Limpar busca">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <Button variant={me ? "brand" : "outline"} onClick={locate} loading={locating} icon={!locating && <LocateFixed className="size-4" />} className="h-11 px-4">
              <span className="hidden sm:inline">{me ? "Perto de mim ✓" : "Perto de mim"}</span>
            </Button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip on={!cat} onClick={() => setCat(null)}>Todos</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>
                <span aria-hidden>{c.emoji}</span> {c.label}
                {counts[c.id] ? <span className="opacity-60">{counts[c.id]}</span> : null}
              </Chip>
            ))}
          </div>
          {isMember && !session?.business && <NeedsBusiness />}
          {!isMember && ready && (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-soft">
              Você está vendo a versão pública. <Link href="/cadastro" className="font-semibold text-teal hover:underline">Crie sua conta</Link> para ver contatos e conversar.
            </p>
          )}
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto p-3 pb-32 lg:pb-6">
          {!ready ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex gap-3 rounded-2xl p-2">
                  <Skeleton className="size-20 shrink-0 !rounded-2xl" />
                  <div className="flex-1 space-y-2 py-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            (data?.businesses.length ?? 0) === 0 ? (
              <Empty icon="🌊" title="Vamos criar a primeira conexão?" body="Ainda não há negócios no mapa. Cadastre o seu e seja o primeiro." action={<Link href="/painel/meu-negocio" className="font-semibold text-teal">Cadastrar meu negócio →</Link>} />
            ) : (
              <Empty icon="🔎" title="Nada encontrado" body="Tente outra palavra ou limpe o filtro de segmento." action={<Button variant="outline" onClick={() => { setQ(""); setCat(null); }}>Limpar filtros</Button>} />
            )
          ) : (
            <motion.ul layout className="space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {list.map((b, i) => (
                  <motion.li
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(i, 12) * 0.03 } }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 36 }}
                  >
                    <ListCard b={b} me={me} hot={b.id === hover || b.id === active} mine={b.id === session?.business?.id} onHover={onHover} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </section>

      {/* Mapa */}
      <section className={clsx("relative flex-1", view === "list" && "max-lg:hidden")}>
        {ready && (desktop || view === "map") && (
          <LeafletMap
            businesses={list}
            hoverId={hover}
            activeId={active}
            me={me}
            focus={focus}
            mineId={session?.business?.id}
            onSelect={(id) => setActive(id)}
            renderPopup={(b) => <PopupCard b={b} me={me} />}
          />
        )}
        {!ready && <div className="skeleton size-full !rounded-none" />}
      </section>

      {/* Alternância no celular */}
      <div className="fixed bottom-24 left-1/2 z-[900] -translate-x-1/2 lg:hidden">
        <div className="glass flex rounded-full p-1">
          {(["list", "map"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={clsx("relative flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold", view === v ? "text-white" : "text-ink-soft")}>
              {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-teal" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative flex items-center gap-1.5">
                {v === "map" ? <MapIcon className="size-4" /> : <List className="size-4" />}
                {v === "map" ? "Mapa" : "Lista"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
        on ? "text-white" : "bg-surface-2 text-ink-soft hover:text-ink",
      )}
      aria-pressed={on}
    >
      {on && <motion.span layoutId="chip-pill" className="absolute inset-0 rounded-full bg-deep" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

function ListCard({ b, me, hot, mine, onHover }: { b: DirectoryEntry; me: { lat: number; lng: number } | null; hot: boolean; mine: boolean; onHover: (b: DirectoryEntry | null) => void }) {
  const c = category(b.category);
  const dist = me && b.lat !== null && b.lng !== null ? formatDistance(haversine(me, { lat: b.lat, lng: b.lng })) : null;
  return (
    <Link
      href={`/negocio/${b.id}`}
      onMouseEnter={() => onHover(b)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(b)}
      className={clsx(
        "group flex gap-3 rounded-2xl border p-2 transition-all duration-300",
        hot ? "border-teal/30 bg-surface shadow-[var(--shadow)]" : "border-transparent hover:bg-surface",
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
        <Cover small name={b.name} cat={b.category} url={b.coverUrl} className="size-full transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-ink">{b.name}</p>
          {dist && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0 rounded-full bg-aqua/15 px-2 py-0.5 text-xs font-bold text-deep dark:text-aqua">
              {dist}
            </motion.span>
          )}
          {mine && !dist && <span className="shrink-0 rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-bold text-coral-deep">Você</span>}
        </div>
        <p className="mt-0.5 text-xs text-ink-faint">
          {c.emoji} {c.label} · {b.neighborhood || b.city}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-soft">{b.partnerOffer || b.description}</p>
        {(b.lat === null || b.lng === null) && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
            <MapPinOff className="size-3" /> Ainda não está no mapa: o dono não marcou o ponto.
          </p>
        )}
      </div>
    </Link>
  );
}

function PopupCard({ b, me }: { b: DirectoryEntry; me: { lat: number; lng: number } | null }) {
  const c = category(b.category);
  const dist = me && b.lat !== null && b.lng !== null ? formatDistance(haversine(me, { lat: b.lat, lng: b.lng })) : null;
  return (
    <div>
      <Cover name={b.name} cat={b.category} url={b.coverUrl} className="h-24 w-full" />
      <div className="p-3.5">
        <p className="font-display text-base font-bold leading-tight text-ink">{b.name}</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          {c.emoji} {c.label} · {b.neighborhood || b.city}
          {dist ? ` · ${dist}` : ""}
        </p>
        <Link href={`/negocio/${b.id}`} className="mt-3 flex items-center justify-center gap-1 rounded-full bg-teal py-2 text-xs font-bold !text-white hover:bg-deep">
          Ver perfil completo <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

