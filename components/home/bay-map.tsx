"use client";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { category } from "@/lib/categories";
import { arcPath, buildNetwork, COAST_PATH, ISLAND_XY, LAND_PATH, NEIGHBORHOODS, project, RIVER_PATH, VB, type BayPin } from "@/lib/bay";

/**
 * A baía de Balneário Camboriú desenhada em SVG, com os negócios reais como pins
 * e a "rede" de conexões entre eles. As classes (bm-*) são animadas pelo GSAP no herói.
 */
export function BayMap({
  pins,
  className,
  interactive = true,
  glow = false,
  idPrefix = "bm",
}: {
  pins: BayPin[];
  className?: string;
  interactive?: boolean;
  glow?: boolean;
  idPrefix?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const net = useMemo(() => buildNetwork(pins), [pins]);
  const hot = useMemo(() => new Set(hover ? net.filter((e) => e.a.id === hover || e.b.id === hover).flatMap((e) => [e.id, e.a.id, e.b.id]) : []), [hover, net]);
  const hoverPin = pins.find((p) => p.id === hover);
  const travelers = net.filter((_, i) => i % 3 === 0).slice(0, 14);
  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className={clsx("overflow-visible", className)} role="img" aria-label="Mapa estilizado de Balneário Camboriú com os negócios da rede conectados">
      <defs>
        <linearGradient id={id("land")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b4f5c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0f8b8d" stopOpacity="0.28" />
        </linearGradient>
        <pattern id={id("dots")} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="#9ff0ea" fillOpacity="0.22" />
        </pattern>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id("soft")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id={id("arc")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fd0c9" />
          <stop offset="1" stopColor="#f4e3c3" />
        </linearGradient>
        <mask id={id("fade")}>
          <radialGradient id={id("fg")} cx="0.62" cy="0.5" r="0.68">
            <stop offset="0.42" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <rect x="-40" y="-40" width={VB.w + 80} height={VB.h + 80} fill={`url(#${id("fg")})`} />
        </mask>
      </defs>

      <g mask={`url(#${id("fade")})`}>
        <g className="bm-land" opacity={glow ? 1 : undefined}>
          <path d={LAND_PATH} fill={`url(#${id("land")})`} />
          <path d={LAND_PATH} fill={`url(#${id("dots")})`} />
          <path d={RIVER_PATH} fill="none" stroke="#3fd0c9" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          {NEIGHBORHOODS.map((n) => {
            const [x, y] = project(n.lat, n.lng);
            return (
              <text key={n.name} x={x} y={y} textAnchor="middle" className="bm-label" fill="#e6fbf8" fillOpacity="0.38" fontSize="11" fontWeight="600" letterSpacing="2.2" style={{ textTransform: "uppercase" }}>
                {n.name}
              </text>
            );
          })}
          <text x={VB.w - 70} y={VB.h * 0.5} textAnchor="middle" fill="#e6fbf8" fillOpacity="0.25" fontSize="13" fontStyle="italic" letterSpacing="3" transform={`rotate(-90 ${VB.w - 70} ${VB.h * 0.5})`}>
            OCEANO ATLÂNTICO
          </text>
        </g>

        <ellipse className="bm-island" cx={ISLAND_XY[0]} cy={ISLAND_XY[1]} rx="9" ry="6" fill="#0f8b8d" fillOpacity="0.6" stroke="#3fd0c9" strokeWidth="1.4" />

        <path d={COAST_PATH} className="bm-coast-glow" fill="none" stroke="#3fd0c9" strokeWidth="7" strokeOpacity="0.45" filter={`url(#${id("soft")})`} pathLength={1} strokeDasharray="1" strokeDashoffset={glow ? 0 : undefined} />
        <path d={COAST_PATH} className="bm-coast" fill="none" stroke="#9ff0ea" strokeWidth="2.2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={glow ? 0 : undefined} />

        <g className="bm-arcs">
          {net.map((e) => (
            <path
              key={e.id}
              d={arcPath(e.a, e.b)}
              className={clsx("bm-arc transition-[stroke-opacity,stroke-width] duration-300")}
              fill="none"
              stroke={`url(#${id("arc")})`}
              strokeWidth={hot.has(e.id) ? 2.2 : 1.1}
              strokeOpacity={hover ? (hot.has(e.id) ? 1 : 0.12) : 0.55}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
            />
          ))}
        </g>

        <g className="bm-travelers">
          {travelers.map((e, i) => (
            <circle
              key={e.id}
              r="2.4"
              fill="#fff"
              filter={`url(#${id("glow")})`}
              style={{
                offsetPath: `path("${arcPath(e.a, e.b)}")`,
                animation: `bm-travel ${2.6 + (i % 4) * 0.7}s ${(i * 0.37) % 3}s linear infinite`,
              }}
            />
          ))}
        </g>

        <g>
          {pins.map((p) => {
            const c = category(p.category);
            const dim = hover && !hot.has(p.id) && hover !== p.id;
            return (
              <g key={p.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                <circle className="bm-ripple" r="10" fill="none" stroke="#9ff0ea" strokeWidth="1.2" opacity="0" />
                <g
                  className={clsx("bm-pin", interactive && "cursor-pointer")}
                  onPointerEnter={interactive ? () => setHover(p.id) : undefined}
                  onPointerLeave={interactive ? () => setHover(null) : undefined}
                  style={{ opacity: dim ? 0.35 : undefined, transition: "opacity .3s" }}
                >
                  <circle r="9" fill={c.hue[0]} opacity="0.35" filter={`url(#${id("soft")})`} />
                  <circle r={hover === p.id ? 6.5 : 4.6} fill={c.hue[0]} stroke="#fff" strokeWidth="1.8" style={{ transition: "r .25s" }} />
                  {interactive && <circle r="14" fill="transparent" />}
                </g>
              </g>
            );
          })}
        </g>
      </g>

      {hoverPin && hoverPin.name && (
        <g transform={`translate(${hoverPin.x} ${hoverPin.y - 16})`} pointerEvents="none">
          <foreignObject x="-110" y="-46" width="220" height="44">
            <div className="flex h-full items-end justify-center">
              <div className="glass-dark rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                {category(hoverPin.category).emoji} {hoverPin.name}
              </div>
            </div>
          </foreignObject>
        </g>
      )}
      <style>{`@keyframes bm-travel { 0% { offset-distance: 0%; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { offset-distance: 100%; opacity: 0 } }
      @media (prefers-reduced-motion: reduce) { .bm-travelers { display: none } }`}</style>
    </svg>
  );
}

export function pinsFrom(list: { id: string; name: string; category: string; lat: number | null; lng: number | null }[]): BayPin[] {
  return list
    .filter((b) => b.lat !== null && b.lng !== null)
    .map((b) => {
      const [x, y] = project(b.lat!, b.lng!);
      return { id: b.id, name: b.name, category: b.category, x, y };
    })
    .filter((p) => p.x > 0 && p.x < VB.w && p.y > 0 && p.y < VB.h);
}
