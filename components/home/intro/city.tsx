"use client";
/**
 * Cidade 3D de Balneário Camboriú para a abertura: prédios instanciados com
 * janelas acesas, morros, ilha, roda-gigante, bondinho e o trânsito da orla.
 * A montagem depende só de `intro.city` (0→1), então pular e repetir funcionam;
 * o relógio interno move apenas detalhes de ambiente (roda, cabines, carros).
 *
 * 7 draw calls: terreno, prédios, luz da rua, estruturas, cabines, pontos de luz, carros.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COAST_PATH, ISLAND_XY, RIVER_PATH } from "@/lib/bay";
import { vbToWorld, type Pillar } from "@/lib/intro-targets";
import type { IntroState } from "@/lib/intro-state";

/* ------------------------------------------------------------------ utilidades */
type XZ = [number, number];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const sstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Gerador determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Converte um path "M x y C ..." (formato de lib/bay) em polilinha no mundo, sem DOM. */
function flatten(path: string, steps: number): XZ[] {
  const out: XZ[] = [];
  let cx = 0;
  let cy = 0;
  for (const m of path.matchAll(/([MLC])([^MLCZ]*)/g)) {
    const n = (m[2].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (m[1] === "C") {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        const b0 = u * u * u;
        const b1 = 3 * u * u * t;
        const b2 = 3 * u * t * t;
        const b3 = t * t * t;
        out.push(vbToWorld(b0 * cx + b1 * n[0] + b2 * n[2] + b3 * n[4], b0 * cy + b1 * n[1] + b2 * n[3] + b3 * n[5]));
      }
    } else {
      out.push(vbToWorld(n[0], n[1]));
    }
    cx = n[n.length - 2];
    cy = n[n.length - 1];
  }
  return out;
}

function distTo(line: XZ[], x: number, z: number) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, az] = line[i - 1];
    const dx = line[i][0] - ax;
    const dz = line[i][1] - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2);
  }
  return Math.sqrt(best);
}

function inside(poly: XZ[], x: number, z: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/* ------------------------------------------------------------------ geografia */
const COAST = flatten(COAST_PATH, 10);
const RIVER = flatten(RIVER_PATH, 8);
// mesmo contorno de LAND_PATH (fecha pelo oeste do viewBox)
const LAND: XZ[] = [...COAST, vbToWorld(-20, 740), vbToWorld(-20, -20), [COAST[0][0], vbToWorld(0, -20)[1]]];
const ISLAND = vbToWorld(ISLAND_XY[0], ISLAND_XY[1]);

// limites norte/sul da praia central, entre Pioneiros e a Barra Sul
const BEACH_N = -1.5;
const BEACH_S = 1.2;
const BEACH = COAST.filter(([x, z]) => z > BEACH_N && z < BEACH_S && x < 0);

/** Roda-gigante: na orla de Pioneiros (norte), de frente para a câmera aérea. */
const WHEEL = { x: -0.5, z: -1.6, r: 0.27, y: 0.35, yaw: 0.24 };

/** Bondinho: Barra Sul → alto do morro → Laranjeiras. */
const CABLE = {
  a: new THREE.Vector3(-0.3, 0.16, 1.32),
  b: new THREE.Vector3(0.78, 0.6, 1.98),
  c: new THREE.Vector3(1.42, 0.2, 2.35),
};

/** Morros: x, z, raio, altura. */
const HILLS: [number, number, number, number][] = [
  // sul (morro do bondinho e Barra)
  [0.78, 1.98, 0.32, 0.5], [0.3, 2.4, 0.42, 0.36], [1.35, 2.85, 0.4, 0.34], [-0.5, 2.6, 0.5, 0.4], [-1.5, 2.45, 0.5, 0.42], [-2.5, 2.3, 0.55, 0.5],
  // oeste (serra)
  [-3.05, 0.9, 0.5, 0.55], [-3.1, -0.1, 0.5, 0.7], [-3, -1.1, 0.55, 0.62], [-2.7, -2.1, 0.55, 0.66],
  // norte (Pioneiros / Praia dos Amores)
  [0.28, -2.45, 0.3, 0.4], [-0.35, -2.75, 0.4, 0.42], [-1.2, -2.7, 0.5, 0.5], [-1.95, -3.1, 0.55, 0.62], [0.75, -3.3, 0.35, 0.34], [-0.1, -3.5, 0.45, 0.46],
];

const hillBase = (x: number, z: number) => {
  let h = 0;
  for (const [hx, hz, r, a] of HILLS) h = Math.max(h, a * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (r * r * 0.7)) * 1.08 - 0.06 * a);
  return h;
};

/** Altura do terreno: some perto da água e abre uma clareira em volta de cada pilar. */
function terrainAt(x: number, z: number, pillars: Pillar[]) {
  let h = hillBase(x, z);
  if (h < 0.02 || !inside(LAND, x, z)) return 0;
  h *= sstep(0.02, 0.28, distTo(COAST, x, z)) * sstep(0.06, 0.35, distTo(RIVER, x, z));
  for (const p of pillars) h *= sstep(0.1, 0.42, Math.hypot(p.x - x, p.z - z));
  return h;
}

/** Posição no cabo: u em 0..2 (subida e descida), com barriga. */
function cablePoint(u: number, side: number, out: THREE.Vector3) {
  const [p, q, t, sag] = u < 1 ? [CABLE.a, CABLE.b, u, 0.07] : [CABLE.b, CABLE.c, u - 1, 0.05];
  out.lerpVectors(p, q, t);
  out.y -= sag * 4 * t * (1 - t);
  out.z += side * 0.022;
  return out;
}

/* ------------------------------------------------------------------ terreno */
function buildTerrain(pillars: Pillar[], mobile: boolean) {
  const rnd = rng(4242);
  const cell = mobile ? 0.17 : 0.12;
  const x0 = -3.5;
  const z0 = -4;
  const nx = Math.ceil(5.6 / cell);
  const nz = Math.ceil(7.6 / cell);
  const grid: [number, number, number][] = [];
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + (i + (rnd() - 0.5) * 0.55) * cell;
      const z = z0 + (j + (rnd() - 0.5) * 0.55) * cell;
      const h = terrainAt(x, z, pillars);
      grid.push([x, h * (0.88 + rnd() * 0.24), z]);
    }
  const pos: number[] = [];
  const bary: number[] = [];
  const delay: number[] = [];
  const tri = (a: number[], b: number[], c: number[], d?: number) => {
    pos.push(...a, ...b, ...c);
    bary.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    for (const v of [a, b, c]) delay.push(d ?? clamp(Math.hypot(v[0] + 0.6, v[2]) / 4.2, 0, 1));
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = grid[j * (nx + 1) + i];
      const b = grid[j * (nx + 1) + i + 1];
      const c = grid[(j + 1) * (nx + 1) + i];
      const d = grid[(j + 1) * (nx + 1) + i + 1];
      if (Math.max(a[1], b[1], c[1]) > 0.02) tri(a, c, b);
      if (Math.max(b[1], c[1], d[1]) > 0.02) tri(b, c, d);
    }
  // ilha das Cabras: três anéis irregulares e um topo
  const seg = 11;
  const rings = [1, 0.72, 0.38].map((k, ri) =>
    Array.from({ length: seg }, (_, s) => {
      const t = ((s + (ri % 2) * 0.5) / seg) * Math.PI * 2;
      const w = k * (0.85 + rnd() * 0.3);
      return [ISLAND[0] + Math.cos(t) * 0.12 * w, [0, 0.07, 0.12][ri] * (0.85 + rnd() * 0.3), ISLAND[1] + Math.sin(t) * 0.15 * w];
    }),
  );
  const top = [ISLAND[0] + 0.01, 0.155, ISLAND[1] - 0.02];
  for (let r = 0; r < 2; r++)
    for (let s = 0; s < seg; s++) {
      const n = (s + 1) % seg;
      tri(rings[r][s], rings[r + 1][s], rings[r][n], 0.25);
      tri(rings[r][n], rings[r + 1][s], rings[r + 1][n], 0.25);
    }
  for (let s = 0; s < seg; s++) tri(rings[2][s], top, rings[2][(s + 1) % seg], 0.25);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aBary", new THREE.Float32BufferAttribute(bary, 3));
  g.setAttribute("aDelay", new THREE.Float32BufferAttribute(delay, 1));
  g.computeVertexNormals(); // sem índice: normais por face (low-poly)
  return g;
}

/* ------------------------------------------------------------------ prédios */
interface Building { x: number; z: number; w: number; d: number; h: number; yaw: number; delay: number; seed: number; tint: number }

// câmera aérea do Rig: usada para não deixar prédio tapar pilar nem ilha
const CAM = { x: 1.4, y: 4.4, z: 5.6 };

function placeBuildings(pillars: Pillar[], target: number): Building[] {
  const rnd = rng(20260);
  const protect: { x: number; z: number; y: number; r: number }[] = pillars.map((p) => ({ x: p.x, z: p.z, y: p.h * 0.3, r: 0.03 }));
  protect.push({ x: ISLAND[0], z: ISLAND[1], y: 0.03, r: 0.12 }, { x: WHEEL.x, z: WHEEL.z, y: 0.1, r: 0.2 });

  /** Altura máxima para o alvo atrás continuar visível da câmera. */
  const heightCap = (x: number, z: number, rad: number) => {
    let cap = 2;
    for (const t of protect) {
      const dx = CAM.x - t.x;
      const dz = CAM.z - t.z;
      const len = Math.hypot(dx, dz);
      const along = ((x - t.x) * dx + (z - t.z) * dz) / len;
      if (along <= 0 || along > 2) continue;
      const side = Math.abs(((x - t.x) * dz - (z - t.z) * dx) / len);
      if (side < t.r + rad) cap = Math.min(cap, t.y + ((CAM.y - t.y) / len) * Math.max(0, along - rad));
    }
    return cap;
  };

  // candidatos em fileiras paralelas à costa, como as quadras da cidade
  interface Cand { x: number; z: number; inland: number; yaw: number; zone: number; score: number; cap: number }
  const cands: Cand[] = [];
  const DX = 0.034;
  for (let i = 1; i < COAST.length; i++) {
    const [ax, az] = COAST[i - 1];
    const [bx, bz] = COAST[i];
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    const steps = Math.max(1, Math.round(len / DX));
    for (let s = 0; s < steps; s++) {
      const t = (s + rnd() * 0.5) / steps;
      for (let row = 0; row < 17; row++) {
        const inland = 0.15 + row * 0.102 + Math.floor(row / 2) * 0.02;
        // a costa vai de norte a sul, então a terra fica em (-tz, tx)
        const x = ax + (bx - ax) * t - tz * inland;
        const z = az + (bz - az) * t + tx * inland;
        if (x < -3 || z < -2.5 || z > 1.8 || !inside(LAND, x, z)) continue;
        const coast = distTo(COAST, x, z);
        if (coast < inland * 0.85 || distTo(RIVER, x, z) < 0.09) continue;
        if (Math.hypot(x - WHEEL.x, z - WHEEL.z) < 0.26 || Math.hypot(x - CABLE.a.x, z - CABLE.a.z) < 0.12) continue;
        if (pillars.some((p) => Math.hypot(p.x - x, p.z - z) < 0.13)) continue;
        if (terrainAt(x, z, pillars) > 0.025) continue;
        // Centro/Barra Sul concentram a cidade; norte e Barra (sul do rio) são baixos
        const zone = sstep(-1.7, -0.5, z) * (1 - sstep(1.35, 1.6, z)) * (0.75 + 0.25 * sstep(-0.3, 0.8, z));
        const near = Math.exp(-coast / 0.55);
        cands.push({ x, z, inland: coast, yaw: Math.atan2(tx, tz), zone, cap: 0, score: (0.12 + zone) * (0.2 + near) * (0.55 + rnd() * 0.45) });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);

  const out: Building[] = [];
  const free = (x: number, z: number, gap: number) => out.every((b) => (b.x - x) ** 2 + (b.z - z) ** 2 >= (gap + b.w / 2) ** 2);
  // a onda sai da praia para o interior e do centro para as pontas
  const delayOf = (c: Cand) => clamp((c.inland / 1.9) * 0.72 + (Math.abs(c.z - 0.4) / 3.6) * 0.28 + rnd() * 0.06, 0, 1);

  // torres: poucas, finas, na primeira quadra e onde menos atrapalham os pilares
  const nTowers = target > 300 ? 8 : 5;
  const front = cands.filter((c) => c.inland < 0.42 && c.x < -0.5 && c.z > -0.85 && c.z < 0.98);
  for (const c of front) c.cap = heightCap(c.x, c.z, 0.035) + rnd() * 0.15;
  front.sort((a, b) => b.cap - a.cap);
  for (const c of front) {
    if (out.length >= nTowers * 2) break;
    if (out.some((b) => Math.hypot(b.x - c.x, b.z - c.z) < 0.22)) continue;
    const h = Math.min(0.86 + rnd() * 0.34, Math.max(c.cap, 0.8));
    const base = { x: c.x, z: c.z, yaw: c.yaw, delay: delayOf(c), seed: rnd(), tint: rnd() };
    // corpo e coroa recuada contam como duas instâncias
    out.push({ ...base, w: 0.064, d: 0.064, h: h * 0.86 }, { ...base, w: 0.036, d: 0.036, h, tint: 0.95 });
  }

  for (const c of cands) {
    if (out.length >= target) break;
    const w = 0.052 + rnd() * 0.034;
    const d = 0.052 + rnd() * 0.034;
    if (!free(c.x, c.z, w / 2 + 0.018)) continue;
    const beach = Math.exp(-c.inland / 0.48);
    const want = 0.09 + rnd() * 0.07 + beach * c.zone * (0.22 + rnd() * 0.55) + c.zone * rnd() ** 3 * 0.22;
    const h = clamp(want, 0.08, Math.max(0.08, Math.min(0.72, heightCap(c.x, c.z, w * 0.7))));
    out.push({ x: c.x, z: c.z, w, d, h, yaw: c.yaw, delay: delayOf(c), seed: rnd(), tint: rnd() });
  }
  return out;
}

function buildBuildings(list: Building[]) {
  const n = list.length;
  const base = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  const place = new Float32Array(n * 4);
  const dim = new Float32Array(n * 3);
  const rand = new Float32Array(n * 3);
  list.forEach((b, i) => {
    place.set([b.x, b.z, Math.cos(b.yaw), Math.sin(b.yaw)], i * 4);
    dim.set([b.w, b.h, b.d], i * 3);
    rand.set([b.delay, b.seed, b.tint], i * 3);
  });
  g.setAttribute("aPlace", new THREE.InstancedBufferAttribute(place, 4));
  g.setAttribute("aDim", new THREE.InstancedBufferAttribute(dim, 3));
  g.setAttribute("aRand", new THREE.InstancedBufferAttribute(rand, 3));
  g.instanceCount = n;
  return g;
}

/** Poça de luz quente no chão de cada prédio; reaproveita os atributos das instâncias. */
function buildStreet(src: THREE.InstancedBufferGeometry) {
  const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  for (const name of ["aPlace", "aRand"]) g.setAttribute(name, src.getAttribute(name));
  g.instanceCount = src.instanceCount;
  return g;
}

/* ------------------------------------------------------------------ estruturas */
/** aKind: 0 = fixo da roda, 1 = parte que gira, 2 = postes do bondinho, 3 = cabos. */
function buildStructures() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, kind: number) => {
    const p = g.index ? g.toNonIndexed() : g;
    if (p !== g) g.dispose();
    for (const name of Object.keys(p.attributes)) if (name !== "position" && name !== "normal") p.deleteAttribute(name);
    p.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(p.getAttribute("position").count).fill(kind), 1));
    parts.push(p);
  };
  const up = new THREE.Vector3(0, 1, 0);
  const beam = (a: THREE.Vector3, b: THREE.Vector3, r: number, kind: number) => {
    const dir = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, dir.length(), 4, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    add(g.translate(mid.x, mid.y, mid.z), kind);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // roda em coordenadas locais (centro na origem, eixo Z)
  for (const z of [-0.025, 0.025]) {
    add(new THREE.TorusGeometry(WHEEL.r, 0.006, 4, 40).translate(0, 0, z), 1);
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2;
      beam(V(0, 0, z * 0.6), V(Math.cos(t) * WHEEL.r, Math.sin(t) * WHEEL.r, z), 0.0028, 1);
    }
    beam(V(-0.16, -WHEEL.y, z * 2.4), V(0, 0, z * 1.6), 0.008, 0);
    beam(V(0.16, -WHEEL.y, z * 2.4), V(0, 0, z * 1.6), 0.008, 0);
  }
  add(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8).rotateX(Math.PI / 2), 1);
  // bondinho em coordenadas do mundo
  for (const p of [CABLE.a, CABLE.b, CABLE.c]) {
    beam(V(p.x, 0, p.z), V(p.x, p.y + 0.02, p.z), 0.011, 2);
    beam(V(p.x, p.y, p.z - 0.04), V(p.x, p.y, p.z + 0.04), 0.008, 2);
  }
  for (const side of [-1, 1])
    for (const s of [0, 1]) {
      const pts = Array.from({ length: 13 }, (_, i) => cablePoint(s + Math.min(i / 12, 0.9999), side, new THREE.Vector3()));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.0032, 3, false), 3);
    }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

const WHEEL_CABINS = 16;

function buildCabins(mobile: boolean) {
  const cable = mobile ? 10 : 16;
  const n = WHEEL_CABINS + cable;
  const base = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  const cab = new Float32Array(n * 2); // tipo (0 roda, 1 bondinho), fase
  for (let i = 0; i < n; i++) cab.set(i < WHEEL_CABINS ? [0, i / WHEEL_CABINS] : [1, (i - WHEEL_CABINS) / cable], i * 2);
  g.setAttribute("aCab", new THREE.InstancedBufferAttribute(cab, 2));
  g.instanceCount = n;
  return g;
}

/* ------------------------------------------------------------------ pontos de luz */
/** aLight: tipo (0 = topo de prédio, 1 = aro da roda), fase, atraso; `position.y` é a altura final. */
function buildLights(list: Building[]) {
  const pos: number[] = [];
  const light: number[] = [];
  for (const b of list)
    if (b.h > 0.5 && (b.h > 0.8 || b.seed > 0.45)) {
      pos.push(b.x, b.h, b.z);
      light.push(0, b.seed, b.delay);
    }
  for (let k = 0; k < 48; k++) {
    pos.push(0, 0, 0);
    light.push(1, k / 48, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aLight", new THREE.Float32BufferAttribute(light, 3));
  return g;
}

/* ------------------------------------------------------------------ carros na orla */
function buildTraffic() {
  const pos: number[] = [];
  const road: number[] = []; // comprimento percorrido, lateral (-1..1), faixa
  const index: number[] = [];
  let total = 0;
  for (let i = 1; i < BEACH.length; i++) total += Math.hypot(BEACH[i][0] - BEACH[i - 1][0], BEACH[i][1] - BEACH[i - 1][1]);
  [0.066, 0.087, 0.108].forEach((off, lane) => {
    let acc = 0;
    const start = pos.length / 3;
    BEACH.forEach(([x, z], i) => {
      const [px, pz] = BEACH[Math.max(0, i - 1)];
      const [nx, nz] = BEACH[Math.min(BEACH.length - 1, i + 1)];
      const len = Math.hypot(nx - px, nz - pz);
      const ox = -(nz - pz) / len;
      const oz = (nx - px) / len;
      if (i) acc += Math.hypot(x - px, z - pz);
      for (const s of [-1, 1]) {
        pos.push(x + ox * (off + s * 0.0085), 0.014, z + oz * (off + s * 0.0085));
        road.push(acc / total, s, lane);
      }
      if (i) {
        const k = start + i * 2;
        index.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aRoad", new THREE.Float32BufferAttribute(road, 3));
  g.setIndex(index);
  return g;
}

/* ------------------------------------------------------------------ shaders */
const f = (n: number) => n.toFixed(4);
const v3 = (v: THREE.Vector3) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;

const common = /* glsl */ `
uniform float uCity, uTime;
float staged(float delay){ return clamp(uCity * 1.75 - delay * 0.75, 0.0, 1.0); }
float easeOut(float t){ return 1.0 - pow(1.0 - t, 3.0); }
/* sobe, passa um tiquinho do ponto e assenta */
float easeBack(float t){ float k = t - 1.0; return 1.0 + 2.0 * k * k * k + 1.0 * k * k; }
`;
// opaco com bordas em névoa: dissolve por pontilhado para o fundo aparecer sem misturar profundidade
const fogFn = /* glsl */ `
/* ruído de gradiente intercalado: sem a trama visível de uma matriz regular */
float dither(vec2 p){ return fract(52.9829189 * fract(dot(floor(p), vec2(0.06711056, 0.00583715)))); }
float edgeFog(vec3 w){ return smoothstep(2.55, 3.65, length((w.xz - vec2(-0.5, -0.3)) * vec2(1.05, 0.95))); }
vec3 applyFog(vec3 c, vec3 w){
  float e = edgeFog(w);
  if (e > dither(gl_FragCoord.xy)) discard;
  return mix(c, vec3(0.014, 0.13, 0.16), e * 0.85);
}
`;
const wheelFn = /* glsl */ `
const float WHEEL_R = ${f(WHEEL.r)};
const vec3 WHEEL_C = vec3(${f(WHEEL.x)}, ${f(WHEEL.y)}, ${f(WHEEL.z)});
float wheelRise(){ return easeBack(clamp(uCity * 2.2 - 0.9, 0.0, 1.0)); }
float wheelAngle(){ return uTime * 0.16; }
/* local da roda → mundo, crescendo a partir do chão */
vec3 wheelWorld(vec3 p, float rise){
  p.y += WHEEL_C.y;
  p *= rise;
  float c = ${f(Math.cos(WHEEL.yaw))}, s = ${f(Math.sin(WHEEL.yaw))};
  return vec3(p.x * c + p.z * s + WHEEL_C.x, p.y, -p.x * s + p.z * c + WHEEL_C.z);
}
float cableRise(){ return easeOut(clamp(uCity * 2.4 - 1.2, 0.0, 1.0)); }
`;

const buildVert = /* glsl */ `
${common}
attribute vec4 aPlace;
attribute vec3 aDim, aRand;
varying vec3 vP, vN, vW, vWN, vDim, vRand;
varying float vRise, vLit;
void main(){
  float t = staged(aRand.x);
  float r = t <= 0.0 ? 0.0 : max(0.0, easeBack(t));
  vRise = r;
  vLit = smoothstep(0.4, 1.0, t);
  vec3 p = position * aDim;
  p.y *= r;
  vP = p; vN = normal; vDim = vec3(aDim.x, aDim.y * r, aDim.z); vRand = aRand;
  vec4 w = modelMatrix * vec4(p.x * aPlace.z + p.z * aPlace.w + aPlace.x, p.y, -p.x * aPlace.w + p.z * aPlace.z + aPlace.y, 1.0);
  vW = w.xyz;
  vWN = vec3(normal.x * aPlace.z + normal.z * aPlace.w, normal.y, -normal.x * aPlace.w + normal.z * aPlace.z);
  gl_Position = r > 0.0 ? projectionMatrix * viewMatrix * w : vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const buildFrag = /* glsl */ `
${common}
${fogFn}
varying vec3 vP, vN, vW, vWN, vDim, vRand;
varying float vRise, vLit;
float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
void main(){
  bool roof = abs(vN.y) > 0.5;
  // MSAA extrapola varyings em triângulos menores que um pixel: limita antes de exp()
  float y = clamp(vP.y, 0.0, vDim.y), below = vDim.y - y;
  float seed = vRand.y, tint = vRand.z;
  vec3 aqua = vec3(0.28, 0.9, 0.84), sand = vec3(1.0, 0.8, 0.56);
  vec3 accent = mix(aqua, sand, step(0.68, tint));
  float k = clamp(vP.y / max(vDim.y, 1e-3), 0.0, 1.0);

  // distância às arestas, em unidades do mundo
  vec2 e;
  if (roof) e = vDim.xz * 0.5 - abs(vP.xz);
  else e = vec2(abs(vN.x) > 0.5 ? vDim.z * 0.5 - abs(vP.z) : vDim.x * 0.5 - abs(vP.x), vDim.y - vP.y);
  float px = max(length(fwidth(vW)) * 0.6, 0.0022);
  float edgeTop = 1.0 - smoothstep(px * 0.4, px * 1.3, e.y);
  float edgeSide = 1.0 - smoothstep(px * 0.4, px * 1.3, e.x);

  // vidro escuro: a face leste (mar) é um pouco mais clara
  float face = roof ? 0.5 : mix(0.55, 1.0, clamp(dot(vWN, normalize(vec3(0.85, 0.0, 0.5))) * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = mix(vec3(0.012, 0.055, 0.075), vec3(0.05, 0.2, 0.24), k * 0.8 + 0.1) * face;

  if (roof) {
    col += accent * max(edgeTop, edgeSide) * 0.2 * (1.0 - smoothstep(0.004, 0.012, px));
  } else {
    float u = (abs(vN.x) > 0.5 ? vP.z : vP.x) + 0.5;
    vec2 g = vec2(u / 0.018, vP.y / 0.027);
    vec2 cell = floor(g), q = fract(g);
    vec2 fw = fwidth(g);
    vec2 a = smoothstep(vec2(0.12), vec2(0.12) + fw + 0.04, q) * smoothstep(vec2(0.12), vec2(0.12) + fw + 0.04, 1.0 - q);
    float shape = mix(a.x * a.y, 0.45, clamp(max(fw.x, fw.y) * 1.2 - 0.5, 0.0, 1.0));
    float id = hash(cell + vec2(seed * 91.0 + vN.x * 7.0, seed * 37.0 + vN.z * 5.0));
    float when = hash(cell + seed * 53.0 + 11.0);
    // cada janela acende na sua hora; depois só cintila devagar
    float occ = 0.38 + 0.3 * fract(seed * 13.0); // uns prédios mais acesos que outros
    float on = step(id, occ) * smoothstep(when * 0.85, when * 0.85 + 0.15, vLit);
    on *= 0.78 + 0.22 * sin(uTime * (0.3 + when) + id * 90.0);
    vec3 wc = mix(mix(sand, vec3(1.0, 0.92, 0.78), when), aqua, step(0.78, hash(cell.yx + seed * 17.0)));
    col += wc * shape * on * 1.05;
    col += aqua * shape * 0.03;
    // topo iluminado dos prédios altos, como as coroas da orla
    col += accent * smoothstep(0.45, 0.8, vDim.y) * exp(-below * 16.0) * 0.5 * vLit;
    col += accent * (edgeTop * 0.34 + edgeSide * (0.03 + 0.1 * k)) * (0.3 + 0.7 * vLit);
    // brilho da rua na base e frente luminosa enquanto sobe
    col += sand * exp(-y * 20.0) * 0.3 * vLit;
    float rising = sin(clamp(vRise, 0.0, 1.0) * 3.14159);
    col += aqua * exp(-below * 30.0) * rising * 0.8;
  }
  gl_FragColor = vec4(min(applyFog(col, vW), vec3(0.95)), 1.0);
}
`;

const streetVert = /* glsl */ `
${common}
attribute vec4 aPlace;
attribute vec3 aRand;
varying vec2 vQ;
varying vec3 vW;
varying float vLit, vTint;
void main(){
  vLit = smoothstep(0.3, 1.0, staged(aRand.x));
  vTint = aRand.z; vQ = position.xz * 2.0;
  vec4 w = modelMatrix * vec4(position.x * 0.24 + aPlace.x, 0.009, position.z * 0.24 + aPlace.y, 1.0);
  vW = w.xyz;
  gl_Position = vLit > 0.0 ? projectionMatrix * viewMatrix * w : vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const streetFrag = /* glsl */ `
${fogFn}
varying vec2 vQ;
varying vec3 vW;
varying float vLit, vTint;
void main(){
  float d = max(0.0, 1.0 - dot(vQ, vQ));
  vec3 c = mix(vec3(1.0, 0.62, 0.34), vec3(0.25, 0.8, 0.75), step(0.82, vTint));
  gl_FragColor = vec4(c, d * d * 0.26 * vLit * (1.0 - edgeFog(vW)));
}
`;

const terrVert = /* glsl */ `
${common}
attribute vec3 aBary;
attribute float aDelay;
varying vec3 vB, vN, vW;
varying float vR;
void main(){
  float r = easeOut(staged(aDelay));
  vR = r; vB = aBary; vN = normal;
  vec3 p = position; p.y *= r;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const terrFrag = /* glsl */ `
${common}
${fogFn}
varying vec3 vB, vN, vW;
varying float vR;
void main(){
  if (vR < 0.001 || vR * 1.4 < dither(gl_FragCoord.xy + 1.0)) discard;
  vec3 n = normalize(vN);
  float light = clamp(dot(n, normalize(vec3(0.7, 0.75, 0.25))), 0.0, 1.0);
  vec3 col = mix(vec3(0.006, 0.04, 0.048), vec3(0.025, 0.17, 0.15), light * 0.85 + 0.06);
  vec3 fw = fwidth(vB);
  vec3 b = smoothstep(vec3(0.0), fw * 1.3 + 0.01, vB);
  float wire = 1.0 - min(b.x, min(b.y, b.z));
  float high = smoothstep(0.0, 0.5, vW.y);
  col += vec3(0.16, 0.74, 0.62) * wire * (0.025 + 0.17 * high);
  // contorno de luz que sobe o morro uma vez, junto com a montagem
  float scan = (vW.y - vR * 0.75) * 12.0;
  col += vec3(0.3, 0.95, 0.65) * exp(-scan * scan) * clamp(1.0 - vR, 0.0, 1.0) * 0.7;
  // a cidade ilumina o pé dos morros
  col += vec3(1.0, 0.66, 0.4) * exp(-length(vW.xz - vec2(-1.1, 0.1)) * 1.6) * step(vW.x, -0.5) * exp(-max(vW.y, 0.0) * 9.0) * vR * 0.4;
  vec3 v = normalize(cameraPosition - vW);
  col += vec3(0.1, 0.6, 0.42) * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0) * 0.3;
  gl_FragColor = vec4(min(applyFog(col, vW), vec3(0.9)), 1.0);
}
`;

const structVert = /* glsl */ `
${common}
${wheelFn}
attribute float aKind;
varying float vKind, vR, vRad;
varying vec3 vW, vN;
void main(){
  vKind = aKind; vN = normal;
  vec3 p = position;
  vRad = length(p.xy);
  if (aKind < 1.5) {
    vR = wheelRise();
    if (aKind > 0.5) {
      float a = wheelAngle(), c = cos(a), s = sin(a);
      p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    }
    p = wheelWorld(p, vR);
  } else {
    vR = cableRise();
    p.y *= vR;
  }
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const structFrag = /* glsl */ `
${common}
${fogFn}
varying float vKind, vR, vRad;
varying vec3 vW, vN;
void main(){
  if (vR < 0.002) discard;
  vec3 aqua = vec3(0.28, 0.9, 0.84), sand = vec3(1.0, 0.8, 0.56);
  vec3 col;
  if (vKind < 0.5) col = vec3(0.1, 0.3, 0.34);
  else if (vKind < 1.5) col = mix(sand * 0.7, aqua * 1.05, smoothstep(0.08, 0.26, vRad)) * (0.7 + 0.3 * sin(vRad * 40.0 - uTime * 2.4));
  else if (vKind < 2.5) col = mix(vec3(0.06, 0.2, 0.22), sand * 0.55, smoothstep(0.0, 0.6, vW.y));
  else col = aqua * 0.42;
  gl_FragColor = vec4(applyFog(col, vW), 1.0);
}
`;

const cabVert = /* glsl */ `
${common}
${wheelFn}
attribute vec2 aCab;
varying vec3 vN, vW, vP;
varying float vR, vType, vPhase;
const vec3 CA = ${v3(CABLE.a)}, CB = ${v3(CABLE.b)}, CC = ${v3(CABLE.c)};
/* igual a cablePoint() no TypeScript */
vec3 cablePoint(float u, float side){
  bool first = u < 1.0;
  float t = first ? u : u - 1.0;
  vec3 p = first ? mix(CA, CB, t) : mix(CB, CC, t);
  p.y -= (first ? 0.07 : 0.05) * 4.0 * t * (1.0 - t);
  p.z += side * 0.022;
  return p;
}
void main(){
  vN = normal; vP = position; vType = aCab.x; vPhase = aCab.y;
  vec3 p;
  if (aCab.x < 0.5) {
    vR = wheelRise();
    float a = wheelAngle() + aCab.y * 6.28318;
    // a cabine acompanha o aro, mas fica sempre em pé
    p = position * vec3(0.03, 0.034, 0.034) + vec3(cos(a) * WHEEL_R, sin(a) * WHEEL_R - 0.022, 0.0);
    p = wheelWorld(p, vR);
  } else {
    vR = cableRise();
    float t = fract(aCab.y + uTime * 0.018) * 2.0;
    float side = t < 1.0 ? 1.0 : -1.0;
    vec3 c = cablePoint(t < 1.0 ? t * 2.0 : (2.0 - t) * 2.0, side);
    c.y = (c.y - 0.026) * vR;
    p = position * vec3(0.04, 0.036, 0.028) * vR + c;
  }
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const cabFrag = /* glsl */ `
${common}
${fogFn}
varying vec3 vN, vW, vP;
varying float vR, vType, vPhase;
void main(){
  if (vR < 0.05) discard;
  vec3 aqua = vec3(0.28, 0.9, 0.84), sand = vec3(1.0, 0.8, 0.56), coral = vec3(1.0, 0.45, 0.36);
  vec3 c = vType < 0.5 ? mix(aqua, sand, step(0.5, fract(vPhase * 8.0))) : mix(sand, coral, step(0.5, fract(vPhase * 5.0)));
  float win = (1.0 - step(0.5, abs(vN.y))) * smoothstep(0.32, 0.2, abs(vP.y - 0.08));
  gl_FragColor = vec4(applyFog(c * (0.36 + win * 0.45), vW), 1.0);
}
`;

const lightVert = /* glsl */ `
${common}
${wheelFn}
uniform float uPR;
attribute vec3 aLight;
varying vec3 vC;
varying float vA;
void main(){
  vec3 p = position;
  float pulse;
  if (aLight.x < 0.5) {
    float t = staged(aLight.z);
    p.y = p.y * max(0.0, easeBack(t)) + 0.012;
    pulse = 0.35 + 0.65 * pow(max(0.0, 0.5 + 0.5 * sin(uTime * 2.0 + aLight.y * 40.0)), 4.0);
    vA = smoothstep(0.75, 1.0, t) * pulse * 0.7;
    vC = mix(vec3(1.0, 0.42, 0.34), vec3(0.4, 0.95, 0.9), step(0.6, fract(aLight.y * 7.0)));
  } else {
    float rise = wheelRise();
    float a = wheelAngle() + aLight.y * 6.28318;
    p = wheelWorld(vec3(cos(a) * WHEEL_R, sin(a) * WHEEL_R, 0.034), rise);
    pulse = 0.55 + 0.45 * sin(aLight.y * 6.28318 * 4.0 - uTime * 2.2);
    vA = smoothstep(0.6, 1.0, rise) * pulse;
    vC = mix(vec3(0.3, 0.92, 0.86), vec3(1.0, 0.8, 0.56), pulse);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 6.5 * uPR * (6.0 / -mv.z);
}
`;
const lightFrag = /* glsl */ `
varying vec3 vC;
varying float vA;
void main(){
  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vC, a * a * vA);
}
`;

const roadVert = /* glsl */ `
attribute vec3 aRoad;
varying vec3 vRoad;
void main(){ vRoad = aRoad; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const roadFrag = /* glsl */ `
${common}
varying vec3 vRoad;
float hash1(float n){ return fract(sin(n * 91.7) * 4375.85); }
void main(){
  float lane = vRoad.z;
  float dir = lane < 0.5 ? 1.0 : -1.0;
  // a avenida se desenha do centro para as pontas
  float draw = clamp(uCity * 2.2 - 0.3, 0.0, 1.0);
  float shown = smoothstep(0.0, 0.06, draw * 0.56 - abs(vRoad.x - 0.5)) * step(0.001, draw);
  float x = vRoad.x * 16.0 - dir * uTime * (0.5 + lane * 0.13) + lane * 5.3;
  float id = floor(x);
  float q = fract(x);
  float has = step(hash1(id + lane * 31.0), 0.72);
  // cabeça brilhante com rastro atrás
  float tail = clamp(dir > 0.0 ? q : 1.0 - q, 0.0, 1.0);
  float streak = pow(tail, 5.0) * smoothstep(1.0, 0.94, tail) * has;
  float across = max(0.0, 1.0 - vRoad.y * vRoad.y);
  vec3 c = lane < 0.5 ? vec3(1.0, 0.82, 0.58) : mix(vec3(1.0, 0.4, 0.32), vec3(0.35, 0.92, 0.86), step(1.5, lane));
  float ends = smoothstep(0.0, 0.04, vRoad.x) * smoothstep(1.0, 0.96, vRoad.x);
  gl_FragColor = vec4(c, (streak * 1.25 + 0.14) * across * shown * ends);
}
`;

/* ------------------------------------------------------------------ componente */
function buildAll(pillars: Pillar[], mobile: boolean) {
  const list = placeBuildings(pillars, mobile ? 180 : 450);
  const uniforms = { uCity: { value: 0 }, uTime: { value: 0 }, uPR: { value: 1 } };
  const opaque = (vertexShader: string, fragmentShader: string) =>
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide });
  const glow = (vertexShader: string, fragmentShader: string) =>
    new THREE.ShaderMaterial({
      vertexShader, fragmentShader, uniforms, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  const buildings = buildBuildings(list);
  const geo = {
    terrain: buildTerrain(pillars, mobile),
    buildings,
    street: buildStreet(buildings),
    structures: buildStructures(),
    cabins: buildCabins(mobile),
    lights: buildLights(list),
    traffic: buildTraffic(),
  };
  const mat = {
    terrain: opaque(terrVert, terrFrag),
    buildings: opaque(buildVert, buildFrag),
    street: glow(streetVert, streetFrag),
    structures: opaque(structVert, structFrag),
    cabins: opaque(cabVert, cabFrag),
    lights: glow(lightVert, lightFrag),
    traffic: glow(roadVert, roadFrag),
  };
  return { geo, mat, uniforms };
}

export function City({ intro, pillars, mobile }: { intro: React.RefObject<IntroState>; pillars: Pillar[]; mobile: boolean }) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const height = useThree((s) => s.size.height);
  const { geo, mat, uniforms } = useMemo(() => buildAll(pillars, mobile), [pillars, mobile]);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mat).forEach((m) => m.dispose());
    },
    [geo, mat],
  );

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const city = intro.current?.city ?? 0;
    g.visible = city > 0.001;
    if (!g.visible) return;
    uniforms.uCity.value = Math.min(1, city);
    uniforms.uTime.value += clamp(dt, 0, 0.05);
    uniforms.uPR.value = gl.getPixelRatio() * (height / 900) * 1.4;
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geo.buildings} material={mat.buildings} frustumCulled={false} />
      <mesh geometry={geo.terrain} material={mat.terrain} frustumCulled={false} />
      <mesh geometry={geo.street} material={mat.street} frustumCulled={false} />
      <mesh geometry={geo.structures} material={mat.structures} frustumCulled={false} />
      <mesh geometry={geo.cabins} material={mat.cabins} frustumCulled={false} />
      <mesh geometry={geo.traffic} material={mat.traffic} frustumCulled={false} />
      <points geometry={geo.lights} material={mat.lights} frustumCulled={false} />
    </group>
  );
}
