"use client";
import Link from "next/link";
import { clsx } from "clsx";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import {
  ArrowRight, BadgeCheck, Check, Handshake, Lock, MapPinned, MessagesSquare, Navigation, ShieldCheck, Sparkles, Store, Users,
} from "lucide-react";
import { CATEGORIES, category } from "@/lib/categories";
import { relativeDate } from "@/lib/format";
import { PRICE_LABEL } from "@/lib/launch";
import { Cover } from "@/components/ui/cover";
import { Empty, SectionTitle } from "@/components/ui/misc";
import { LinkButton, Magnetic } from "@/components/ui/button";
import { FlipClock } from "@/components/app/countdown";
import { BayMap, pinsFrom } from "./bay-map";
import { decorativePins } from "@/lib/bay";
import type { DirectoryEntry } from "@/lib/backend/types";

const ease = [0.16, 1, 0.3, 1] as const;

export function Reveal({ children, delay = 0, className, y = 40 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Contador "odômetro" ---------------- */
function Digit({ d, delay }: { d: number; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none">
      <motion.span
        className="flex flex-col"
        initial={{ y: "0em" }}
        whileInView={{ y: `-${d}em` }}
        viewport={{ once: true }}
        transition={{ duration: 1.8 + delay, delay: delay * 0.6, ease }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block h-[1em]">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export function Odometer({ value, className }: { value: number; className?: string }) {
  const digits = String(Math.max(0, value)).split("").map(Number);
  return (
    <span className={clsx("inline-flex tabular-nums", className)} aria-label={String(value)}>
      {digits.map((d, i) => (
        <Digit key={`${digits.length}-${i}`} d={d} delay={(digits.length - i) * 0.15} />
      ))}
    </span>
  );
}

export function Stats({ businesses, locked }: { businesses: DirectoryEntry[]; locked: boolean }) {
  const segments = new Set(businesses.map((b) => b.category)).size;
  const hoods = new Set(businesses.map((b) => b.neighborhood).filter(Boolean)).size;
  const items = locked
    ? []
    : [
        { v: businesses.length, label: "negócios na rede", icon: Store },
        { v: segments, label: "segmentos diferentes", icon: Sparkles },
        { v: hoods, label: "bairros conectados", icon: MapPinned },
      ];
  return (
    <section id="numeros" className="relative bg-[#01141a] pb-28 pt-10 text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {locked ? (
          <Reveal className="mx-auto max-w-2xl text-center">
            <Lock className="mx-auto mb-4 size-8 text-aqua" />
            <p className="font-display text-3xl font-bold">O diretório agora é exclusivo para assinantes.</p>
            <p className="mt-3 text-white/60">Entre ou assine para ver o mapa completo e falar com os negócios.</p>
          </Reveal>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 sm:grid-cols-3">
            {items.map((it, i) => (
              <Reveal key={it.label} delay={i * 0.1} className="bg-[#01141a] p-8 sm:p-10">
                <it.icon className="mb-6 size-6 text-aqua" />
                <div className="font-display text-7xl font-bold tracking-tight sm:text-8xl">
                  <Odometer value={it.v} />
                </div>
                <p className="mt-3 text-white/60">{it.label}</p>
              </Reveal>
            ))}
          </div>
        )}
      </div>
      <svg className="absolute inset-x-0 -bottom-px h-16 w-full text-bg sm:h-24" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden>
<path fill="#3fd0c9" fillOpacity=".12" d="M0 40 C 300 90 520 0 820 40 S 1260 80 1440 20 V100 H0Z" />
        <path fill="currentColor" d="M0 60 C 240 10 480 10 720 50 S 1200 100 1440 40 V100 H0Z" />
      </svg>
    </section>
  );
}

/* ---------------- Cartão com inclinação 3D ---------------- */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [0, 1], [-10, 10]), { stiffness: 200, damping: 20 });
  const glare = useTransform([x, y] as never, ([a, b]: number[]) => `radial-gradient(420px circle at ${a * 100}% ${b * 100}%, rgba(255,255,255,.28), transparent 45%)`);
  return (
    <div style={{ perspective: 900 }} className={className}>
      <motion.div
        ref={ref}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = ref.current!.getBoundingClientRect();
          x.set((e.clientX - r.left) / r.width);
          y.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          x.set(0.5);
          y.set(0.5);
        }}
        className="group relative h-full"
      >
        {children}
        <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare, borderRadius: "1.75rem" }} />
      </motion.div>
    </div>
  );
}

export function BusinessTile({ b, distance }: { b: DirectoryEntry; distance?: string }) {
  const c = category(b.category);
  return (
    <Link href={`/negocio/${b.id}`} className="card block h-full overflow-hidden rounded-[1.75rem] transition-shadow hover:shadow-[var(--shadow-lg)]">
      <div className="relative h-44 overflow-hidden">
        <div className="size-full transition-transform duration-[1.6s] ease-out group-hover:scale-110">
          <Cover name={b.name} cat={b.category} url={b.coverUrl} className="size-full" />
        </div>
        <span className="glass-dark absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white">
          {c.emoji} {c.label}
        </span>
      </div>
      <div className="p-5" style={{ transform: "translateZ(30px)" }}>
        <h3 className="font-display text-xl font-bold leading-tight">{b.name}</h3>
        <p className="mt-1 text-sm text-ink-faint">
          {b.neighborhood || b.city}
          {distance ? ` · ${distance}` : ""} · entrou {relativeDate(b.createdAt)}
        </p>
        <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{b.description}</p>
      </div>
    </Link>
  );
}

export function Latest({ businesses, locked }: { businesses: DirectoryEntry[]; locked: boolean }) {
  const latest = [...businesses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  if (locked) return null;
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal>
          <SectionTitle eyebrow="Acabaram de chegar" title={<>Novos vizinhos <br className="hidden sm:block" />na rede</>} />
        </Reveal>
        <Reveal delay={0.1}>
          <LinkButton href="/explorar" variant="outline">
            Ver todos no mapa <ArrowRight className="size-4" />
          </LinkButton>
        </Reveal>
      </div>
      {latest.length === 0 ? (
        <Reveal className="card mt-12 rounded-[2rem]">
          <Empty
            icon="🌊"
            title="Vamos criar a primeira conexão?"
            body="Ainda não há negócios cadastrados. Seja o primeiro de Balneário Camboriú a aparecer no mapa."
            action={<LinkButton href="/cadastro" variant="primary">Cadastrar meu negócio</LinkButton>}
          />
        </Reveal>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {latest.map((b, i) => (
            <Reveal key={b.id} delay={i * 0.12}>
              <TiltCard className="h-full">
                <BusinessTile b={b} />
              </TiltCard>
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- Faixa de segmentos ---------------- */
export function Marquee() {
  const row = [...CATEGORIES, ...CATEGORIES];
  return (
    <section className="relative overflow-hidden py-10" aria-label="Segmentos da rede">
      <div className="-rotate-2 scale-105 bg-gradient-to-r from-deep via-teal to-deep py-5 shadow-2xl">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {row.map((c, i) => (
            <span key={i} className="glass-dark flex items-center gap-2 rounded-full px-5 py-2.5 text-lg font-semibold text-white">
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 rotate-1 scale-105 bg-sand/70 py-4 dark:bg-white/5">
        <div className="flex w-max animate-marquee-rev gap-8">
          {row.map((c, i) => (
            <span key={i} className="font-display flex items-center gap-8 text-3xl font-bold text-deep/70 dark:text-foam/40">
              {c.label}
              <span className="text-coral">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Bento com holofote ---------------- */
const VALUES = [
  { icon: Users, title: "Só negócios locais", body: "Uma rede B2B: aqui não tem turista nem avaliação de cliente. Só quem empreende em BC.", span: "md:col-span-2" },
  { icon: ShieldCheck, title: "Contatos protegidos", body: "Telefone, WhatsApp e Instagram só aparecem para membros. Visitantes veem o básico." },
  { icon: Navigation, title: "Perto de verdade", body: "“Perto de mim” calcula a distância real até cada parceiro: 350 m, 1,2 km…" },
  { icon: Handshake, title: "Parcerias com registro", body: "Proponha indicação, desconto cruzado ou evento. O outro lado aceita com um clique e os dois ficam com o histórico.", span: "md:col-span-2" },
  { icon: MessagesSquare, title: "Conversa privada", body: "Um chat só entre estabelecimentos, sem expor seu número pessoal." },
  { icon: Store, title: "Sua vitrine B2B", body: "Diga que tipo de parceiro você procura e qual benefício oferece. O mapa vira uma vitrine de oportunidades para quem está do seu lado.", span: "md:col-span-2" },
];

export function Values() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <Reveal>
        <SectionTitle center eyebrow="Por que ConectaBC" title="Feito para quem tem porta aberta na cidade" body="Menos grupo de WhatsApp perdido, mais parceria que dá resultado." />
      </Reveal>
      <div
        ref={ref}
        className="spotlight mt-14 grid gap-4 md:grid-cols-3"
        onPointerMove={(e) => {
          const cards = ref.current!.querySelectorAll<HTMLElement>(".spot-card");
          cards.forEach((c) => {
            const r = c.getBoundingClientRect();
            c.style.setProperty("--x", `${e.clientX - r.left}px`);
            c.style.setProperty("--y", `${e.clientY - r.top}px`);
          });
        }}
      >
        {VALUES.map((v, i) => (
          <Reveal key={v.title} delay={i * 0.07} className={clsx(v.span)}>
            <div className="spot-card card h-full rounded-[1.75rem] p-7 sm:p-8">
              <div className="mb-10 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-aqua/30 to-teal/10 text-teal">
                <v.icon className="size-6" />
              </div>
              <h3 className="font-display text-2xl font-bold">{v.title}</h3>
              <p className="mt-2 text-ink-soft">{v.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Planos ---------------- */
export function Pricing({ loggedIn }: { loggedIn: boolean }) {
  const perks = ["Mapa completo com contatos", "Chat privado ilimitado", "Propostas de parceria", "Seu negócio visível para a rede", "Cancele quando quiser"];
  return (
    <section id="planos" className="relative overflow-hidden bg-[#01141a] py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute -left-40 top-20 size-[520px] rounded-full bg-teal/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 size-[520px] rounded-full bg-coral/15 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-aqua">Lançamento oficial</p>
          <h2 className="font-display text-5xl font-bold leading-[0.95] sm:text-7xl">
            Grátis até <span className="text-gradient">15 de janeiro</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/65">Use tudo sem pagar nada até o lançamento. Depois, uma assinatura simples, sem fidelidade.</p>
        </Reveal>
        <Reveal delay={0.1} className="mt-12 flex justify-center">
          <FlipClock light />
        </Reveal>
        <Reveal delay={0.2} className="mx-auto mt-16 max-w-lg">
          <div className="conic-border rounded-[2rem]">
            <div className="rounded-[2rem] bg-[#04232b]/90 p-8 backdrop-blur sm:p-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-aqua">Membro ConectaBC</p>
                  <p className="mt-2 flex items-end gap-1">
                    <span className="font-display text-6xl font-bold">{PRICE_LABEL}</span>
                    <span className="mb-2 text-white/50">/mês</span>
                  </p>
                  <p className="text-sm text-white/50">a partir de 15/01/2027 · cobrança recorrente em reais</p>
                </div>
                <BadgeCheck className="size-8 text-aqua" />
              </div>
              <ul className="mt-8 space-y-3">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-white/85">
                    <span className="grid size-6 place-items-center rounded-full bg-aqua/15 text-aqua">
                      <Check className="size-3.5" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <Magnetic className="mt-9 w-full" strength={0.15}>
                <LinkButton href={loggedIn ? "/painel/assinatura" : "/cadastro"} variant="primary" size="lg" className="w-full">
                  Garantir minha vaga <ArrowRight className="size-4" />
                </LinkButton>
              </Magnetic>
              <p className="mt-4 text-center text-xs text-white/45">
                Cadastre o cartão agora e a primeira cobrança só acontece em 15/01/2027. Pagamento processado pelo Stripe — seu cartão nunca passa pelo ConectaBC.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Fechamento ---------------- */
export function Closing({ businesses, locked }: { businesses: DirectoryEntry[]; locked: boolean }) {
  const pins = locked ? decorativePins(30) : pinsFrom(businesses);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <section className="relative overflow-hidden bg-[#01141a] pb-24 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
        <div ref={ref} className="relative order-2 mx-auto aspect-[3/4] w-full max-w-md lg:order-1">
          <motion.div initial={{ opacity: 0, scale: 0.85, rotate: -6 }} animate={inView ? { opacity: 1, scale: 1, rotate: 0 } : {}} transition={{ duration: 1.6, ease }} className="size-full">
            <BayMap pins={pins} glow interactive={!locked} idPrefix="cl" className="size-full drop-shadow-[0_0_40px_rgba(63,208,201,0.25)]" />
          </motion.div>
        </div>
        <Reveal className="order-1 lg:order-2">
          <h2 className="font-display text-5xl font-bold leading-[0.95] sm:text-6xl">
            Cada ponto é um negócio.
            <br />
            <span className="text-gradient">Cada linha, uma parceria</span> esperando para acontecer.
          </h2>
          <p className="mt-6 max-w-md text-lg text-white/65">Cadastre seu negócio em dois minutos, marque seu ponto no mapa e comece a conversar com quem está do seu lado.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Magnetic>
              <LinkButton href="/cadastro" variant="primary" size="lg">
                Cadastrar meu negócio <ArrowRight className="size-4" />
              </LinkButton>
            </Magnetic>
            <LinkButton href="/explorar" variant="glass" size="lg">
              Ver o mapa
            </LinkButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
