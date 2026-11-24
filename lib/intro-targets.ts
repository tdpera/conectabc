/**
 * Alvos das partículas da abertura 3D: o logotipo (plano vertical) e a baía
 * (plano do chão), mais a posição 3D dos "pilares de luz" de cada negócio.
 */
import { COAST_PATH, LAND_PATH, RIVER_PATH, VB, type BayPin } from "./bay";

/** Centro de interesse da baía no viewBox (fica na origem do mundo 3D). */
const CX = 330;
const CY = 380;
const UNIT = 100;

/** viewBox (540×720) → plano do chão XZ. Norte (topo do mapa) aponta para −Z. */
export function vbToWorld(vx: number, vy: number): [number, number] {
  return [(vx - CX) / UNIT, (vy - CY) / UNIT];
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export interface Pillar {
  id: string;
  name: string;
  category: string;
  x: number;
  z: number;
  h: number;
  delay: number;
}

/** Pilares: altura estável por negócio; hotéis são as "torres" de BC. */
export function pillarsFrom(pins: BayPin[]): Pillar[] {
  return pins.map((p) => {
    const [x, z] = vbToWorld(p.x, p.y);
    const r = hash(p.id + p.name);
    const tower = p.category === "hoteis" ? 1.55 : 1;
    return { id: p.id, name: p.name, category: p.category, x, z, h: (0.38 + r * 0.8) * tower, delay: hash(p.id) };
  });
}

/** Repete/embaralha amostras até completar `n` pontos (com leve jitter nas repetições). */
export function fitPoints(samples: Float32Array, n: number, jitter = 0.01, seed = 1): Float32Array {
  const count = samples.length / 3;
  const out = new Float32Array(n * 3);
  if (count === 0) return out;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const j = i < count ? i : Math.floor(rnd() * count);
    const extra = i < count ? 0 : jitter;
    out[i * 3] = samples[j * 3] + (rnd() - 0.5) * extra;
    out[i * 3 + 1] = samples[j * 3 + 1] + (rnd() - 0.5) * extra;
    out[i * 3 + 2] = samples[j * 3 + 2] + (rnd() - 0.5) * extra;
  }
  return out;
}

/** Amostra pixels de "ConectaBC" escrito com a fonte de display. Precisa do DOM. */
export async function logoPoints(n: number, width = 5): Promise<Float32Array> {
  await document.fonts?.ready;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-bricolage").trim() || "sans-serif";
  const W = 1400;
  const H = 360;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 230px ${family}`;
  ctx.fillText("ConectaBC", W / 2, H / 2);
  const data = ctx.getImageData(0, 0, W, H).data;
  // limites reais do texto para centralizar
  let minX = W, maxX = 0, minY = H, maxY = 0;
  const pts: number[] = [];
  for (let y = 0; y < H; y += 3)
    for (let x = 0; x < W; x += 3)
      if (data[(y * W + x) * 4 + 3] > 140) {
        pts.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  const scale = width / Math.max(1, maxX - minX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const count = pts.length / 2;
  const out = new Float32Array(count * 3);
  // embaralha para que o atraso por partícula não "varra" da esquerda para a direita
  const order = Array.from({ length: count }, (_, i) => i).sort(() => Math.random() - 0.5);
  order.forEach((k, i) => {
    out[i * 3] = (pts[k * 2] - cx) * scale;
    out[i * 3 + 1] = -(pts[k * 2 + 1] - cy) * scale;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.42; // letras com volume real
  });
  return fitPoints(out, n, 0.02);
}

/** Linha da costa (densa), rio e pontos de terra (esparsos). Retorna posições e um "tipo" (1 = costa). */
export function coastPoints(n: number): { pos: Float32Array; kind: Float32Array } {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden");
  const coast = document.createElementNS("http://www.w3.org/2000/svg", "path");
  coast.setAttribute("d", COAST_PATH);
  const river = document.createElementNS("http://www.w3.org/2000/svg", "path");
  river.setAttribute("d", RIVER_PATH);
  svg.append(coast, river);
  document.body.appendChild(svg);

  const pos = new Float32Array(n * 3);
  const kind = new Float32Array(n);
  const nCoast = Math.floor(n * 0.42);
  const nRiver = Math.floor(n * 0.06);
  let i = 0;
  const put = (vx: number, vy: number, k: number, y = 0) => {
    const [x, z] = vbToWorld(vx, vy);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    kind[i] = k;
    i++;
  };
  const lc = coast.getTotalLength();
  for (let k = 0; k < nCoast; k++) {
    const p = coast.getPointAtLength((k / nCoast) * lc);
    const j = (Math.random() - 0.5) * 3.2; // leve espessura
    put(p.x + j, p.y + j * 0.6, 1, Math.random() * 0.02);
  }
  const lr = river.getTotalLength();
  for (let k = 0; k < nRiver; k++) {
    const p = river.getPointAtLength((k / nRiver) * lr);
    put(p.x + (Math.random() - 0.5) * 2, p.y + (Math.random() - 0.5) * 2, 0.6);
  }
  svg.remove();

  // terra: rasteriza o contorno uma vez em baixa resolução e consulta pixels (muito mais barato que isPointInPath)
  const MW = 270;
  const MH = 360;
  const mask = document.createElement("canvas");
  mask.width = MW;
  mask.height = MH;
  const mctx = mask.getContext("2d", { willReadFrequently: true })!;
  mctx.scale(MW / VB.w, MH / VB.h);
  mctx.fill(new Path2D(LAND_PATH));
  const px = mctx.getImageData(0, 0, MW, MH).data;
  let guard = 0;
  while (i < n && guard++ < n * 30) {
    const vx = 20 + Math.random() * (VB.w - 20);
    const vy = Math.random() * VB.h;
    const mi = (Math.floor((vy / VB.h) * MH) * MW + Math.floor((vx / VB.w) * MW)) * 4 + 3;
    if (px[mi] < 128) continue;
    // mais denso perto da orla, como a cidade
    if (Math.random() > 0.25 + (vx / VB.w) * 0.9) continue;
    put(vx, vy, 0);
  }
  while (i < n) put(CX, CY, 0); // segurança (não deve acontecer)
  return { pos, kind };
}
