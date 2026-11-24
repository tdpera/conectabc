import raw from "@/lib/data/enderecos-bc.json";
import { haversine } from "@/lib/geo";
import type { Place } from "@/lib/places";

/** Busca de endereços de Balneário Camboriú sobre o CNEFE/IBGE (Censo 2022), sem serviço externo nem chave. */
type Num = [n: number, lat: number, lng: number, hood: number];
const data = raw as unknown as { hoods: string[]; streets: [string, Num[]][] };

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const TYPES = new Set(["rua", "avenida", "rodovia", "travessa", "alameda", "servidao", "estrada", "beco", "praca", "via", "acesso"]);
const ABBR: Record<string, string> = { r: "rua", av: "avenida", ave: "avenida", rod: "rodovia", tv: "travessa", trav: "travessa", al: "alameda", estr: "estrada", gov: "governador", "3a": "terceira", "4a": "quarta", "5a": "quinta" };
const SKIP = new Set(["n", "no", "nr", "num", "numero", "de", "da", "do", "das", "dos", "e"]);

const STREETS = data.streets.map(([name, nums]) => {
  const tokens = norm(name).split(" ").filter((t) => !SKIP.has(t));
  return { name, nums, tokens, hoods: new Set(nums.flatMap((n) => norm(data.hoods[n[3]]).split(" ")).filter(Boolean)) };
});

const place = (name: string, n: Num, number: number | null, approx: boolean): Place => ({
  label: number === null ? name : `${name}, ${number}`,
  address: number === null ? name : `${name}, ${number}`,
  neighborhood: data.hoods[n[3]] ?? "",
  city: "Balneário Camboriú",
  state: "SC",
  lat: n[1] / 1e6,
  lng: n[2] / 1e6,
  precision: number === null ? "street" : approx ? "approx" : "exact",
});

function tokenize(q: string) {
  return norm(q.replace(/\b\d{5}-?\d{3}\b/g, " "))
    .replace(/\bbalneario camboriu\b|\bsanta catarina$|\bsc\b/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((t) => ABBR[t] ?? t)
    .filter((t) => !SKIP.has(t));
}

/** Quanto os termos combinam com a rua; -1 se algum termo não combina. */
function match(tokens: string[], s: (typeof STREETS)[number], open: boolean) {
  const left = [...s.tokens];
  let score = 0;
  let named = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const last = open && i === tokens.length - 1;
    let k = left.indexOf(t);
    let pts = 10;
    if (k < 0 && (last || (t.length >= 3 && !/^\d+$/.test(t)))) {
      k = left.findIndex((x) => x.startsWith(t));
      pts = 6;
    }
    if (k >= 0) {
      if (!TYPES.has(left[k])) named = true;
      left.splice(k, 1);
      score += pts;
    } else if (s.hoods.has(t) && named) score += 3;
    else return -1;
  }
  if (!named) return -1;
  return score - left.filter((t) => !TYPES.has(t)).length * 3;
}

export function searchLocal(q: string, limit = 6): Place[] {
  const tokens = tokenize(q);
  if (!tokens.length || norm(q).length < 2) return [];
  const hits: { p: Place; score: number }[] = [];
  // número do imóvel = um termo numérico que não é o primeiro (aceita "Rua 1500, 200" e "Av Brasil 1500 Centro")
  const at = tokens.map((t, i) => (i > 0 && /^\d{1,5}$/.test(t) ? i : -1)).filter((i) => i > 0);
  for (const s of STREETS) {
    const plain = match(tokens, s, true);
    if (plain >= 0) {
      const mid = s.nums[Math.floor(s.nums.length / 2)];
      hits.push({ p: place(s.name, mid, null, false), score: plain + Math.min(2, s.nums.length / 60) });
    }
    for (const i of at) {
      const score = match(tokens.filter((_, j) => j !== i), s, false);
      if (score < 0) continue;
      const want = Number(tokens[i]);
      const near = s.nums.reduce((a, b) => (Math.abs(b[0] - want) < Math.abs(a[0] - want) ? b : a));
      const gap = Math.abs(near[0] - want);
      if (gap === 0) hits.push({ p: place(s.name, near, want, false), score: score + 14 });
      else if (gap <= 120) hits.push({ p: place(s.name, near, want, true), score: score + 8 - gap / 30 });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.p.label.localeCompare(b.p.label, "pt-BR", { numeric: true }));
  const seen = new Set<string>();
  return hits.map((h) => h.p).filter((p) => !seen.has(p.label) && seen.add(p.label)).slice(0, limit);
}

/** Endereço registrado mais próximo de um ponto (até `max` metros). */
export function reverseLocal(lat: number, lng: number, max = 90): Place | null {
  let best: Place | null = null;
  let d = max;
  for (const s of STREETS)
    for (const n of s.nums) {
      if (Math.abs(n[1] / 1e6 - lat) > 0.0012 || Math.abs(n[2] / 1e6 - lng) > 0.0012) continue;
      const m = haversine({ lat, lng }, { lat: n[1] / 1e6, lng: n[2] / 1e6 });
      if (m < d) {
        d = m;
        best = place(s.name, n, n[0], false);
      }
    }
  return best;
}
