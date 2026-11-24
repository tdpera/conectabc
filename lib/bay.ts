/**
 * Projeção simples (equiretangular corrigida) da região de Balneário Camboriú
 * para um viewBox SVG, e um contorno estilizado da baía a partir de coordenadas reais.
 */
export const VB = { w: 540, h: 720 };
const LNG0 = -48.66;
const LAT0 = -26.952;
const K = 10000; // 0,0001° = 1 unidade
const COS = 0.89; // cos(-27°)

export function project(lat: number, lng: number): [number, number] {
  return [(lng - LNG0) * K * COS, (LAT0 - lat) * K];
}

type LL = [number, number];
// Linha da costa, de norte a sul (lat, lng)
const COAST: LL[] = [
  [-26.948, -48.6075], [-26.952, -48.6085], [-26.957, -48.61], [-26.962, -48.6128], [-26.9665, -48.6148],
  [-26.97, -48.6195], [-26.9735, -48.625], [-26.9765, -48.629], [-26.98, -48.6313], [-26.985, -48.6325],
  [-26.99, -48.6324], [-26.995, -48.6313], [-26.999, -48.6293], [-27.002, -48.625], [-27.0045, -48.6222],
  [-27.006, -48.619], [-27.0045, -48.614], [-27.007, -48.609], [-27.012, -48.6055], [-27.018, -48.603],
  [-27.026, -48.6005],
];
const RIVER: LL[] = [
  [-27.006, -48.619], [-27.0063, -48.623], [-27.0058, -48.629], [-27.0047, -48.635], [-27.0036, -48.642],
  [-27.004, -48.65], [-27.002, -48.662],
];
const ISLAND = { lat: -26.9975, lng: -48.6255 };

export const NEIGHBORHOODS: { name: string; lat: number; lng: number }[] = [
  { name: "Praia dos Amores", lat: -26.9605, lng: -48.6215 },
  { name: "Pioneiros", lat: -26.979, lng: -48.643 },
  { name: "Centro", lat: -26.9905, lng: -48.6445 },
  { name: "Nações", lat: -26.9985, lng: -48.6485 },
  { name: "Barra Sul", lat: -27.0018, lng: -48.6345 },
  { name: "Barra", lat: -27.0115, lng: -48.6425 },
];

/** Curva suave (Catmull-Rom → Bézier cúbica) passando pelos pontos. */
function smooth(pts: [number, number][]): string {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const coastPts = COAST.map(([a, b]) => project(a, b));
export const COAST_PATH = smooth(coastPts);
export const LAND_PATH = `${COAST_PATH} L-20 ${VB.h + 20} L-20 -20 L${coastPts[0][0].toFixed(1)} -20 Z`;
export const RIVER_PATH = smooth(RIVER.map(([a, b]) => project(a, b)));
export const ISLAND_XY = project(ISLAND.lat, ISLAND.lng);

export interface BayPin {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
}

export function arcPath(a: BayPin, b: BayPin): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const k = 0.28;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/** Rede: cada pin se liga aos 2 vizinhos mais próximos, mais algumas ligações longas. */
export function buildNetwork(pins: BayPin[]): { a: BayPin; b: BayPin; id: string }[] {
  const seen = new Set<string>();
  const out: { a: BayPin; b: BayPin; id: string }[] = [];
  const add = (a: BayPin, b: BayPin) => {
    const id = [a.id, b.id].sort().join("~");
    if (a.id === b.id || seen.has(id)) return;
    seen.add(id);
    out.push({ a, b, id });
  };
  for (const p of pins) {
    const near = pins
      .filter((q) => q !== p)
      .map((q) => ({ q, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2 }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    near.forEach(({ q }) => add(p, q));
  }
  for (let i = 0; i < pins.length; i += 5) add(pins[i], pins[(i * 7 + 11) % pins.length]);
  return out;
}

/** Pins decorativos (sem dados reais) para quando o diretório não pode ser exibido. */
export function decorativePins(n = 30): BayPin[] {
  const out: BayPin[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  while (out.length < n) {
    const lat = -26.962 - rnd() * 0.048;
    const lng = -48.656 + rnd() * 0.02;
    const [x, y] = project(lat, lng);
    if (x < 30 || y < 30) continue;
    out.push({ id: "d" + out.length, name: "", category: "outros", x, y });
  }
  return out;
}
