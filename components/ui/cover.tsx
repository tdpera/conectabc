import { clsx } from "clsx";
import { category } from "@/lib/categories";
import { initials } from "@/lib/format";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Capa do negócio: usa a imagem informada ou gera uma arte única (ondas e
 * a inicial do nome) a partir da categoria — sem custo de armazenamento.
 */
export function Cover({ name, cat, url, className, big, small }: { name: string; cat: string; url?: string | null; className?: string; big?: boolean; small?: boolean }) {
  const c = category(cat);
  const h = hash(name);
  const a = (h % 60) - 30;
  const y1 = 55 + (h % 15);
  const y2 = 70 + ((h >> 4) % 12);
  return (
    <div className={clsx("relative isolate overflow-hidden", className)} style={{ background: `linear-gradient(${120 + a}deg, ${c.hue[0]}, ${c.hue[1]})` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <>
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
            <circle cx={60 + (h % 280)} cy={40 + ((h >> 3) % 30)} r={26 + (h % 20)} fill="rgba(255,255,255,0.22)" />
            <path d={`M0 ${y1} C 80 ${y1 - 18}, 160 ${y1 + 22}, 240 ${y1} S 360 ${y1 - 14}, 400 ${y1 + 6} V200 H0Z`} transform="scale(1,1.6) translate(0,-30)" fill="rgba(255,255,255,0.16)" />
            <path d={`M0 ${y2} C 90 ${y2 + 16}, 170 ${y2 - 20}, 260 ${y2 + 4} S 370 ${y2 + 12}, 400 ${y2} V200 H0Z`} transform="scale(1,1.6) translate(0,-30)" fill="rgba(3,34,43,0.16)" />
          </svg>
          {small ? (
            <span className="absolute inset-0 grid place-items-center text-3xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]" aria-hidden>{c.emoji}</span>
          ) : (
          <>
          <span
            className={clsx("font-display absolute select-none font-extrabold leading-none text-white/90 drop-shadow-[0_6px_20px_rgba(0,0,0,0.25)]", big ? "bottom-6 right-8 text-[9rem] opacity-30 sm:opacity-100" : "bottom-2 right-4 text-6xl")}
            aria-hidden
          >
            {initials(name)}
          </span>
          {!big && <span className="absolute left-4 top-4 text-2xl" aria-hidden>{c.emoji}</span>}
          </>
          )}
        </>
      )}
      <div className="grain absolute inset-0" />
    </div>
  );
}
