"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowRight, ChevronDown, MapPinned } from "lucide-react";
import { BayMap, pinsFrom } from "./bay-map";
import { decorativePins, type BayPin } from "@/lib/bay";
import { LinkButton, Magnetic } from "@/components/ui/button";
import { INTRO_DONE } from "@/components/app/header";
import type { DirectoryEntry } from "@/lib/backend/types";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const OceanScene = dynamic(() => import("./ocean-scene"), { ssr: false });

const LINES = [["Seu", "próximo"], ["parceiro", "está"], ["aqui", "perto."]];
const PLAYED = "conectabc:intro-played";

function webglOk() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    const lowPower = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return !(lowPower && lowPower < 2);
  } catch {
    return false;
  }
}

export function Hero({ businesses, ready, locked }: { businesses: DirectoryEntry[]; ready: boolean; locked: boolean }) {
  const root = useRef<HTMLElement>(null);
  const reveal = useRef(0);
  const mouse = useRef<[number, number]>([0.5, 0.5]);
  const [gl, setGl] = useState(false);
  const [active, setActive] = useState(true);
  const [intro, setIntro] = useState(true);
  const [pending, setPending] = useState(true);
  const tl = useRef<gsap.core.Timeline | null>(null);

  const pins: BayPin[] = useMemo(() => {
    if (!ready) return [];
    if (locked) return decorativePins(30);
    return pinsFrom(businesses);
  }, [businesses, ready, locked]);
  const count = businesses.length;

  // Paralaxe do mapa com o mouse
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), { stiffness: 80, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 80, damping: 18 });

  const [glReady, setGlReady] = useState(false);
  useEffect(() => {
    // Carrega o three.js só quando o navegador estiver ocioso: o pôster em CSS cobre o início.
    const ok = webglOk();
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (ok) {
      if (w.requestIdleCallback) w.requestIdleCallback(() => setGl(true), { timeout: 1500 });
      else setTimeout(() => setGl(true), 600);
    }
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  const finish = () => {
    setIntro(false);
    (window as unknown as { __introDone?: boolean }).__introDone = true;
    window.dispatchEvent(new Event(INTRO_DONE));
    try {
      sessionStorage.setItem(PLAYED, "1");
    } catch {}
  };

  useGSAP(
    () => {
      if (!ready) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let played = false;
      try {
        played = sessionStorage.getItem(PLAYED) === "1";
      } catch {}

      const q = gsap.utils.selector(root);
      const r = { v: 0 };
      const t = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: finish });
      tl.current = t;

      gsap.set(q(".bm-arc"), { strokeDashoffset: 1 });
      gsap.set(q(".bm-coast, .bm-coast-glow"), { strokeDashoffset: 1 });
      gsap.set(q(".bm-land, .bm-island, .bm-travelers"), { opacity: 0 });
      gsap.set(q(".bm-pin"), { opacity: 0, y: -26, scale: 0.2, transformOrigin: "50% 100%" });
      gsap.set(q(".hw"), { y: 0, yPercent: 115, rotate: 5, fontWeight: 300 });
      gsap.set(q(".h-fade"), { opacity: 0, y: 26, filter: "blur(8px)" });
      setPending(false);

      // 1. Preto → água (o pôster acompanha enquanto o WebGL carrega)
      t.fromTo(q(".hero-poster"), { opacity: 0 }, { opacity: 1, duration: 2.0, ease: "power2.inOut" }, 0);
      t.to(r, { v: 1, duration: 2.4, ease: "power2.inOut", onUpdate: () => (reveal.current = r.v) }, 0);
      // 2. A costa se desenha
      t.to(q(".bm-coast-glow"), { strokeDashoffset: 0, duration: 2.2, ease: "power3.inOut" }, 0.35);
      t.to(q(".bm-coast"), { strokeDashoffset: 0, duration: 2.0, ease: "power3.inOut" }, 0.45);
      t.to(q(".bm-land"), { opacity: 1, duration: 1.6, ease: "power2.out" }, 1.0);
      t.to(q(".bm-island"), { opacity: 1, duration: 0.6 }, 1.7);
      // 3. Os pins caem
      t.to(q(".bm-pin"), { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "back.out(2.6)", stagger: { each: 0.028, from: "random" } }, 1.25);
      t.fromTo(q(".bm-ripple"), { opacity: 0.9, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 0, scale: 3.4, duration: 1.1, ease: "power2.out", immediateRender: false, stagger: { each: 0.028, from: "random" } }, 1.45);
      // 4. A rede se forma
      t.to(q(".bm-arc"), { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", stagger: { each: 0.03, from: "center" } }, 2.0);
      t.to(q(".bm-travelers"), { opacity: 1, duration: 0.8 }, 2.9);
      // 5. Manchete
      t.to(q(".hw"), { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.075 }, 0.9);
      t.to(q(".hw"), { fontWeight: 760, duration: 1.6, ease: "power2.out", stagger: 0.075 }, 1.1);
      t.to(q(".h-fade"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.0, stagger: 0.1 }, 1.5);
      t.add(() => window.dispatchEvent(new Event(INTRO_DONE)), 2.0);

      if (reduce) t.progress(1);
      else if (played) t.timeScale(3.2);

      // Saída com o scroll
      gsap.to(q(".hero-content"), {
        yPercent: -18, opacity: 0, ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(q(".hero-map"), {
        scale: 1.12, yPercent: -10, opacity: 0.25, ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });

      const skip = (e: KeyboardEvent) => e.key === "Escape" && t.progress(1);
      window.addEventListener("keydown", skip);
      return () => window.removeEventListener("keydown", skip);
    },
    { scope: root, dependencies: [ready, pins.length] },
  );

  return (
    <section
      ref={root}
      className={`${pending ? "intro-pending " : ""}relative isolate h-[100svh] min-h-[680px] overflow-hidden bg-[#01141a] text-white`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        mouse.current = [x, y];
        mx.set(x - 0.5);
        my.set(y - 0.5);
      }}
    >
      {/* Pôster (fallback sem WebGL e antes do canvas carregar) */}
      <div
        className="hero-poster absolute inset-0 transition-opacity duration-1000"
        style={{
          opacity: glReady ? 0 : undefined,
          background:
            "radial-gradient(80% 60% at 80% 0%, rgba(255,140,100,.25), transparent 60%), radial-gradient(120% 80% at 50% 0%, #0f6f73 0%, #0b4f5c 30%, #03222b 70%, #01141a 100%)",
        }}
      />
      {gl && (
        <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: glReady ? 1 : 0 }}>
          <OceanScene reveal={reveal} mouse={mouse} active={active} onReady={() => setTimeout(() => setGlReady(true), 120)} />
        </div>
      )}

      {/* Mapa da baía */}
      <div className="hero-map pointer-events-none absolute inset-x-0 bottom-[-8%] top-[34%] opacity-70 sm:top-[28%] lg:inset-y-0 lg:left-[44%] lg:right-[-6%] lg:top-0 lg:opacity-100" style={{ perspective: 1200 }}>
        <motion.div className="pointer-events-auto mx-auto h-full w-full max-w-[720px]" style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
          {ready && <BayMap pins={pins} className="h-full w-full" interactive={!locked} />}
        </motion.div>
      </div>

      {/* Conteúdo */}
      <div className="hero-content relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 pt-16 sm:px-8 lg:pt-10">
        <div className="max-w-[640px]">
          <div className="h-fade mb-6 inline-flex items-center gap-2 rounded-full glass-dark px-3 py-1.5 text-[13px] font-medium text-white/90">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-aqua opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-aqua" />
            </span>
            {locked ? (
              "Rede exclusiva para assinantes"
            ) : count > 0 ? (
              <span>
                <strong className="tabular-nums">{count}</strong> {count === 1 ? "negócio já está" : "negócios já estão"} na rede
              </span>
            ) : (
              "Rede B2B de Balneário Camboriú"
            )}
          </div>

          <h1 className="font-display text-[3.3rem] leading-[0.92] tracking-[-0.045em] sm:text-7xl lg:text-[6.2rem]" aria-label="Seu próximo parceiro está aqui perto.">
            {LINES.map((line, i) => (
              <span key={i} className="block" aria-hidden>
                {line.map((w, j) => (
                  <span key={j} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom last:mr-0">
                    <span className={`hw inline-block ${i === 2 ? "text-gradient" : ""}`} style={{ fontWeight: 760 }}>
                      {w}
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p className="h-fade mt-7 max-w-[520px] text-lg leading-relaxed text-white/75 sm:text-xl">
            A rede privada dos donos de negócios de Balneário Camboriú. Ache parceiros no mapa, converse direto e feche parcerias que trazem clientes de verdade.
          </p>

          <div className="h-fade mt-9 flex flex-wrap items-center gap-3">
            <Magnetic>
              <LinkButton href="/explorar" variant="primary" size="lg" icon={<MapPinned className="size-5" />}>
                Explorar o mapa
              </LinkButton>
            </Magnetic>
            <LinkButton href="/cadastro" variant="glass" size="lg">
              Criar conta grátis <ArrowRight className="size-4" />
            </LinkButton>
          </div>
          <p className="h-fade mt-5 text-sm text-white/50">Para donos de negócios, não para turistas. Grátis até 15/01/2027.</p>
        </div>
      </div>

      {intro && (
        <button
          onClick={() => tl.current?.progress(1)}
          className="absolute bottom-6 right-6 z-20 rounded-full px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          Pular intro ⏎
        </button>
      )}

      <a href="#numeros" className="h-fade absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50 hover:text-white sm:flex" aria-label="Role para ver mais">
        Role
        <ChevronDown className="size-4 animate-bounce" />
      </a>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#01141a]/40" />
    </section>
  );
}
