"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { initialIntro, type IntroState } from "@/lib/intro-state";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const OceanScene = dynamic(() => import("./ocean-scene"), { ssr: false });
const IntroScene = dynamic(() => import("./intro-scene"), { ssr: false });
/** Tempo máximo esperando a cena 3D antes de cair para a abertura em SVG. */
const SCENE_TIMEOUT = 2600;

const LINES = [["Seu", "próximo"], ["parceiro", "está"], ["aqui", "perto."]];
const PLAYED = "conectabc:intro-played";

/** Renderizadores por software (sem GPU) não aguentam a abertura 3D com fluidez. */
function softwareRenderer() {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return true;
  }
}

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
  const router = useRouter();
  const [mode, setMode] = useState<"pending" | "3d" | "svg">("pending");
  const [sceneReady, setSceneReady] = useState(false);
  const introState = useRef<IntroState>(initialIntro());
  const hoverId = useRef<string | null>(null);
  const [hovering, setHovering] = useState(false);

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
    const ok = webglOk();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const force = new URLSearchParams(window.location.search).get("intro");
    const can3d = force === "3d" || (force !== "svg" && ok && !softwareRenderer());
    if (can3d && !reduce) setMode("3d");
    else {
      setMode("svg");
      // Sem a abertura 3D, a água ainda carrega quando o navegador estiver ocioso.
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (ok) {
        if (w.requestIdleCallback) w.requestIdleCallback(() => setGl(true), { timeout: 1500 });
        else setTimeout(() => setGl(true), 600);
      }
    }
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0 });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, []);

  // Se a cena 3D não ficar pronta a tempo, usa a abertura em SVG.
  useEffect(() => {
    if (mode !== "3d" || sceneReady) return;
    const t = setTimeout(() => {
      setMode("svg");
      setGl(true);
    }, SCENE_TIMEOUT);
    return () => clearTimeout(t);
  }, [mode, sceneReady]);

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
      if (!ready || mode === "pending" || (mode === "3d" && !sceneReady)) return;
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

      if (mode === "3d") {
        const s = introState.current;
        Object.assign(s, initialIntro());
        // 1. Preto → água; partículas acordam
        t.to(s, { reveal: 1, duration: 2.2, ease: "power2.inOut" }, 0);
        // 2. Partículas formam o logotipo
        t.to(s, { logo: 1, duration: 1.35, ease: "none" }, 0.45);
        // 3. Explosão + clarão
        t.to(s, { burst: 1, duration: 0.7, ease: "power3.out" }, 1.8);
        t.to(s, { flash: 1, duration: 0.1, ease: "power2.out" }, 1.8);
        t.to(s, { flash: 0, duration: 0.7, ease: "power2.in" }, 1.9);
        t.fromTo(q(".hero-flash"), { opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 1, duration: 0.12, ease: "power2.out" }, 1.8);
        t.to(q(".hero-flash"), { opacity: 0, scale: 1.6, duration: 0.9, ease: "power2.out" }, 1.92);
        // 4. Pousam na baía enquanto a câmera inclina
        t.to(s, { coast: 1, duration: 1.5, ease: "none" }, 2.05);
        t.to(s, { tilt: 1, duration: 1.9, ease: "power3.inOut" }, 2.15);
        t.to(s, { grid: 1, duration: 1.2, ease: "power2.out" }, 2.4);
        t.to(s, { settle: 1, duration: 1.7, ease: "power2.inOut" }, 2.6);
        // 5. Skyline de luz e a rede
        t.to(s, { rise: 1, duration: 1.3, ease: "none" }, 3.0);
        t.to(s, { draw: 1, duration: 1.3, ease: "none" }, 3.45);
        // 6. Manchete
        t.to(q(".hw"), { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.075 }, 3.55);
        t.to(q(".hw"), { fontWeight: 760, duration: 1.6, ease: "power2.out", stagger: 0.075 }, 3.75);
        t.to(q(".h-fade"), { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.0, stagger: 0.1 }, 4.05);
        t.add(() => window.dispatchEvent(new Event(INTRO_DONE)), 4.3);

        if (played) t.timeScale(3.2);

        gsap.to(q(".hero-content"), {
          yPercent: -18, opacity: 0, ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to(s, { scroll: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });

        const skip3d = (e: KeyboardEvent) => e.key === "Escape" && t.progress(1);
        window.addEventListener("keydown", skip3d);
        return () => window.removeEventListener("keydown", skip3d);
      }

      // ---- Abertura em SVG (sem WebGL, movimento reduzido ou cena lenta) ----
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
    { scope: root, dependencies: [ready, pins.length, mode, sceneReady] },
  );

  return (
    <section
      ref={root}
      className={`${pending ? "intro-pending " : ""}relative isolate h-[100svh] min-h-[680px] overflow-hidden bg-[#01141a] text-white`}
      onClick={(e) => {
        if (!hoverId.current || (e.target as HTMLElement).closest("a,button")) return;
        router.push(`/negocio/${hoverId.current}`);
      }}
      style={{ cursor: hovering ? "pointer" : undefined }}
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
          opacity: mode !== "svg" || glReady ? 0 : undefined,
          background:
            "radial-gradient(80% 60% at 80% 0%, rgba(255,140,100,.25), transparent 60%), radial-gradient(120% 80% at 50% 0%, #0f6f73 0%, #0b4f5c 30%, #03222b 70%, #01141a 100%)",
        }}
      />
      {mode === "3d" && ready && (
        <div className="hero-map absolute inset-0 transition-opacity duration-700" style={{ opacity: sceneReady ? 1 : 0 }}>
          <IntroScene
            intro={introState}
            mouse={mouse}
            pins={pins}
            active={active}
            interactive={!locked}
            onReady={() => setSceneReady(true)}
            onHover={(id) => {
              hoverId.current = id;
              setHovering(!!id);
            }}
          />
        </div>
      )}
      <div className="hero-flash pointer-events-none absolute left-1/2 top-1/2 size-[140vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ background: "radial-gradient(circle, rgba(230,255,250,.9) 0%, rgba(63,208,201,.35) 18%, transparent 45%)" }} />
      {gl && mode === "svg" && (
        <div className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: glReady ? 1 : 0 }}>
          <OceanScene reveal={reveal} mouse={mouse} active={active} onReady={() => setTimeout(() => setGlReady(true), 120)} />
        </div>
      )}

      {/* Mapa da baía */}
      {mode === "svg" && (
      <div className="hero-map pointer-events-none absolute inset-x-0 bottom-[-8%] top-[34%] opacity-70 sm:top-[28%] lg:inset-y-0 lg:left-[44%] lg:right-[-6%] lg:top-0 lg:opacity-100" style={{ perspective: 1200 }}>
        <motion.div className="pointer-events-auto mx-auto h-full w-full max-w-[720px]" style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
          {ready && <BayMap pins={pins} className="h-full w-full" interactive={!locked} />}
        </motion.div>
      </div>
      )}

      {/* Véu para legibilidade no celular, onde o texto fica sobre a cena */}
      <div className="h-fade pointer-events-none absolute inset-0 bg-gradient-to-b from-[#01141a]/80 via-[#01141a]/55 to-[#01141a]/10 lg:hidden" />

      {/* Conteúdo */}
      <div className="hero-content relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-5 pt-24 sm:px-8 lg:pt-10">
        <div className="max-w-[640px]">
          <div className="h-fade mb-5 inline-flex items-center gap-2 rounded-full glass-dark px-3 py-1.5 text-[13px] font-medium text-white/90">
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

          <h1 className="font-display text-[2.9rem] leading-[0.92] tracking-[-0.045em] sm:text-7xl lg:text-[6.2rem]" aria-label="Seu próximo parceiro está aqui perto.">
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
