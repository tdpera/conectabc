"use client";
import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Handshake, MapPinned, MessagesSquare, Navigation, Send } from "lucide-react";
import confetti from "canvas-confetti";
import { BayMap } from "./bay-map";
import type { BayPin } from "@/lib/bay";
import { SectionTitle } from "@/components/ui/misc";

const STEPS = [
  {
    icon: MapPinned,
    kicker: "01 · Encontre",
    title: "Ache negócios aqui do lado",
    body: "Abra o mapa, filtre por segmento e toque em “Perto de mim”. Você vê na hora quem está a 300 metros e procura exatamente o que você oferece.",
  },
  {
    icon: MessagesSquare,
    kicker: "02 · Converse",
    title: "Fale direto com o dono",
    body: "Sem intermediário e sem expor seu número pessoal. Um chat privado entre estabelecimentos, com histórico de tudo o que foi combinado.",
  },
  {
    icon: Handshake,
    kicker: "03 · Feche parceria",
    title: "Formalize a parceria",
    body: "Proponha indicação de clientes, desconto cruzado ou um evento em conjunto. O outro lado aceita com um toque e os dois ficam com o registro.",
  },
];

export function PhoneStory({ pins }: { pins: BayPin[] }) {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section id="como-funciona" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 size-[600px] rounded-full bg-aqua/15 blur-[140px]" />
      <SectionTitle eyebrow="Como funciona" title={<>Três passos. <br />Zero burocracia.</>} />
      <div className="mt-6 grid gap-10 lg:mt-0 lg:grid-cols-[1fr_440px] lg:gap-20">
        <div>
          {STEPS.map((s, i) => (
            <div key={i} ref={(el) => { refs.current[i] = el; }} data-i={i} className="flex min-h-0 flex-col justify-center py-10 lg:min-h-[85vh] lg:py-0">
              <motion.div
                animate={{ opacity: step === i ? 1 : 0.28, x: step === i ? 0 : -6 }}
                transition={{ duration: 0.5 }}
                className="max-lg:!opacity-100 max-lg:!translate-x-0"
              >
                <div className="mb-5 flex items-center gap-3">
                  <span className={clsx("grid size-12 place-items-center rounded-2xl transition-colors duration-500", step === i ? "bg-teal text-white" : "bg-surface-2 text-ink-faint")}>
                    <s.icon className="size-6" />
                  </span>
                  <span className="text-sm font-bold uppercase tracking-[0.2em] text-brand-ink">{s.kicker}</span>
                </div>
                <h3 className="font-display text-4xl font-bold leading-tight sm:text-5xl">{s.title}</h3>
                <p className="mt-4 max-w-lg text-lg text-ink-soft">{s.body}</p>
              </motion.div>
              <div className="mt-8 flex justify-center lg:hidden">
                <Phone small>
                  <Screen step={i} pins={pins} active={step === i} />
                </Phone>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-[calc(var(--hh,96px)+4vh)] flex h-[calc(100vh-var(--hh,96px)-8vh)] items-center justify-center">
            <Phone>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.03, filter: "blur(10px)" }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Screen step={step} pins={pins} active />
                </motion.div>
              </AnimatePresence>
            </Phone>
            <div className="absolute -right-2 top-1/2 flex -translate-y-1/2 flex-col gap-2">
              {STEPS.map((_, i) => (
                <span key={i} className={clsx("w-1.5 rounded-full transition-all duration-500", step === i ? "h-8 bg-teal" : "h-1.5 bg-line")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Phone({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <motion.div
      className={clsx("relative shrink-0 rounded-[3rem] bg-gradient-to-b from-[#20363c] to-[#0b1a1e] p-2.5 shadow-[0_50px_100px_-30px_rgba(3,34,43,0.65)]", small ? "h-[520px] w-[260px]" : "h-[640px] w-[320px]")}
      initial={{ rotateY: -18, rotateX: 6 }}
      whileInView={{ rotateY: -8, rotateX: 4 }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
    >
      <div className="relative size-full overflow-hidden rounded-[2.5rem] bg-[#01141a]">
        <div className="absolute left-1/2 top-2.5 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-transparent via-white/5 to-white/15" />
    </motion.div>
  );
}

function Screen({ step, pins, active }: { step: number; pins: BayPin[]; active: boolean }) {
  if (step === 0) return <MapScreen pins={pins} />;
  if (step === 1) return <ChatScreen active={active} />;
  return <DealScreen active={active} />;
}

function MapScreen({ pins }: { pins: BayPin[] }) {
  return (
    <div className="relative size-full bg-gradient-to-b from-[#0b4f5c] to-[#01141a]">
      <div className="absolute inset-x-[-20%] top-4 bottom-24">
        <BayMap pins={pins} glow interactive={false} idPrefix="ph" className="size-full" />
      </div>
      <div className="absolute inset-x-3 top-12 flex gap-2">
        <div className="glass-dark flex-1 rounded-full px-3 py-2 text-xs text-white/60">Buscar café, hotel, bar…</div>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }} className="flex items-center gap-1 rounded-full bg-coral px-3 py-2 text-xs font-bold text-white">
          <Navigation className="size-3" /> Perto
        </motion.div>
      </div>
      <motion.div
        initial={{ y: 120 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.9, type: "spring", stiffness: 160, damping: 20 }}
        className="absolute inset-x-3 bottom-3 rounded-3xl bg-white p-3.5 text-abyss shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ff7a59] to-[#ffb36b] text-xl">🍽️</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">Cantina Nonna Beatrice</p>
            <p className="text-xs text-abyss/60">Restaurantes · Centro</p>
          </div>
          <span className="rounded-full bg-teal/10 px-2 py-1 text-xs font-bold text-teal">350 m</span>
        </div>
      </motion.div>
    </div>
  );
}

const CHAT = [
  { me: false, t: "Oi! Somos da Pousada Vento Sul. Nossos hóspedes pedem indicação de café 😊" },
  { me: true, t: "Que ótimo! Posso deixar cartões com 10% de desconto na recepção?" },
  { me: false, t: "Pode sim! Manda uns 50 que a gente distribui no check-in." },
  { me: true, t: "Fechado. Passo aí amanhã com os cartões ☕" },
];

function ChatScreen({ active }: { active: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    setN(0);
    const ts = CHAT.map((_, i) => setTimeout(() => setN(i + 1), 500 + i * 1100));
    return () => ts.forEach(clearTimeout);
  }, [active]);
  const typing = n < CHAT.length && n > 0 && !CHAT[n].me;
  return (
    <div className="flex size-full flex-col bg-[#f5fbfa] text-abyss">
      <div className="flex items-center gap-2.5 border-b border-black/5 bg-white px-4 pb-3 pt-12">
        <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#0b4f5c] to-[#2dd4bf] text-sm">🏨</div>
        <div>
          <p className="text-sm font-bold">Pousada Vento Sul</p>
          <p className="text-[10px] text-teal">conversa privada entre estabelecimentos</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 p-3">
        <AnimatePresence initial={false}>
          {CHAT.slice(0, n).map((m, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, x: m.me ? 30 : -30, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className={clsx("max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug shadow-sm", m.me ? "self-end rounded-br-md bg-teal text-white" : "self-start rounded-bl-md bg-white")}
            >
              {m.t}
            </motion.div>
          ))}
          {typing && (
            <motion.div key="typing" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-1 self-start rounded-2xl bg-white px-3 py-3 shadow-sm">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="size-1.5 rounded-full bg-abyss/40" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 border-t border-black/5 bg-white p-2.5">
        <div className="flex-1 rounded-full bg-[#eef7f6] px-3 py-2 text-xs text-abyss/40">Escreva uma mensagem…</div>
        <div className="grid size-8 place-items-center rounded-full bg-teal text-white">
          <Send className="size-3.5" />
        </div>
      </div>
    </div>
  );
}

function DealScreen({ active }: { active: boolean }) {
  const [accepted, setAccepted] = useState(false);
  const btn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    setAccepted(false);
    const t = setTimeout(() => {
      setAccepted(true);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = btn.current?.getBoundingClientRect();
      if (r && r.top > 0 && r.top < window.innerHeight)
        confetti({
          particleCount: 90, spread: 75, startVelocity: 38, scalar: 0.9,
          origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
          colors: ["#3fd0c9", "#0f8b8d", "#ff7a59", "#f4e3c3", "#ffffff"],
        });
    }, 1800);
    return () => clearTimeout(t);
  }, [active]);
  return (
    <div className="flex size-full flex-col bg-[#f5fbfa] px-3 pb-4 pt-12 text-abyss">
      <p className="px-1 text-lg font-bold">Parcerias</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[["Recebidas", 3], ["Aguardando", accepted ? 1 : 2], ["Aceitas", accepted ? 3 : 2]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white p-2 text-center shadow-sm">
            <motion.p key={String(v)} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-lg font-bold">{v}</motion.p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-abyss/50">{l}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex-1" style={{ perspective: 900 }}>
        <motion.div
          animate={{ rotateY: accepted ? 180 : 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-[300px]"
        >
          <div className="absolute inset-0 rounded-3xl bg-white p-4 shadow-lg [backface-visibility:hidden]">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#0284c7] to-[#67e8f9]">⛱️</span>
              <div>
                <p className="text-sm font-bold">Escuna Horizonte Azul</p>
                <p className="text-[11px] text-abyss/50">propôs · há 2 min</p>
              </div>
            </div>
            <span className="mt-3 inline-block rounded-full bg-aqua/15 px-2 py-0.5 text-[11px] font-bold text-deep">🏷️ Desconto cruzado</span>
            <p className="mt-2 text-[12.5px] leading-snug text-abyss/75">15% no passeio para clientes do café e 10% no café para nossos passageiros. Deixamos folhetos dos dois lados.</p>
            <div className="mt-4 flex gap-2">
              <div className="flex-1 rounded-full border border-black/10 py-2 text-center text-xs font-bold">Recusar</div>
              <motion.div ref={btn} animate={{ scale: [1, 1, 0.92, 1] }} transition={{ times: [0, 0.8, 0.9, 1], duration: 1.8 }} className="flex-1 rounded-full bg-teal py-2 text-center text-xs font-bold text-white">
                Aceitar
              </motion.div>
            </div>
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-3xl bg-gradient-to-br from-teal to-deep p-5 text-center text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div>
              <motion.div animate={accepted ? { scale: [0, 1.2, 1] } : {}} transition={{ delay: 0.4, duration: 0.6 }} className="mx-auto grid size-16 place-items-center rounded-full bg-white/20">
                <Check className="size-8" />
              </motion.div>
              <p className="mt-4 text-xl font-bold">Parceria aceita!</p>
              <p className="mt-1 text-xs text-white/70">Escuna Horizonte Azul + Café Maré Alta</p>
              <div className="mt-4 rounded-full bg-white px-3 py-2 text-xs font-bold text-teal">Abrir conversa</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
