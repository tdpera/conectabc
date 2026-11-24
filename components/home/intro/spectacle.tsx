"use client";
/**
 * Efeitos da abertura 3D: túnel de luz (Warp) e estilhaços de cristal (Shatter).
 * Tudo é instanciado e animado na GPU. O Shatter é função pura de `s.shatter`,
 * então pular ou repetir a abertura sempre dá o mesmo resultado.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { IntroState } from "@/lib/intro-state";

type Props = { intro: React.RefObject<IntroState>; mobile: boolean };

/** Quadros iniciais desenhados com tamanho zero, só para compilar os shaders antes da hora. */
const WARMUP = 2;
const LOGO_W = 5;
const LOGO_H = 1.2;

/** Gerador pseudoaleatório com semente fixa (mulberry32). */
function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function instanced(base: THREE.BufferGeometry, n: number, attrs: Record<string, [Float32Array, number]>) {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(base.index);
  for (const name of Object.keys(base.attributes)) g.setAttribute(name, base.attributes[name]);
  for (const [name, [data, itemSize]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(data, itemSize));
  g.instanceCount = n;
  return g;
}

/* ------------------------------------------------------------------ túnel de luz */
/*
 * O túnel vive no espaço da câmera (só a projectionMatrix é aplicada): a Rig gira a câmera
 * enquanto o logotipo se forma, e o ponto de fuga precisa continuar no centro da tela.
 */
const TUNNEL = 62;
/** Onde o ciclo recomeça: cabeça e cauda (8) já atrás da câmera. */
const BEHIND = 9;

const warpVert = /* glsl */ `
uniform float uWarp, uTravel;
attribute vec4 aStreak; // ângulo, raio, profundidade 0..1, velocidade
attribute vec3 aColor;
attribute vec2 aSize; // espessura, comprimento
varying vec3 vColor;
varying float vT, vFade, vX;
void main(){
  vT = position.y + 0.5; // 0 = cauda, 1 = cabeça
  vX = position.x * 2.0;
  float len = aSize.y * (0.15 + 0.85 * uWarp);
  float head = mod(aStreak.z * ${TUNNEL.toFixed(1)} + uTravel * aStreak.w, ${TUNNEL.toFixed(1)}) - ${(TUNNEL - BEHIND).toFixed(1)};
  float z = head + (position.y - 0.5) * len;
  float dist = max(-z, 0.0);
  // espessura mínima em tela, para não cintilar ao longe
  float w = (aSize.x + dist * 0.0022) * smoothstep(0.0, 0.25, uWarp);
  // espiral leve: gira com a profundidade e com a viagem
  float a = aStreak.x + z * 0.028 * uWarp + uTravel * 0.012;
  float c = cos(a), s = sin(a);
  // fita na tangente do túnel: vista do eixo, está sempre de frente
  vec3 p = vec3(c * aStreak.y - s * position.x * w, s * aStreak.y + c * position.x * w, z);
  vFade = (1.0 - smoothstep(20.0, 50.0, dist)) * smoothstep(0.3, 2.6, dist) * smoothstep(0.0, 0.5, uWarp);
  vColor = aColor;
  gl_Position = projectionMatrix * vec4(p, 1.0);
}
`;
const warpFrag = /* glsl */ `
varying vec3 vColor;
varying float vT, vFade, vX;
void main(){
  // MSAA extrapola os varyings em fitas subpixel: sem limite, o HDR + bloom vira um clarão
  float edge = clamp(1.0 - vX * vX, 0.0, 1.0);
  float t = clamp(vT, 0.0, 1.0);
  float a = t * t * clamp(vFade, 0.0, 1.0) * edge * (1.0 - smoothstep(0.985, 1.0, t));
  float hot = edge * edge * edge * smoothstep(0.55, 1.0, t);
  gl_FragColor = vec4(mix(vColor, vec3(0.92, 1.0, 0.98), hot * 0.6), a);
}
`;

/* Portais (anéis que passam pela câmera) e o clarão do ponto de fuga. */
const gateVert = /* glsl */ `
uniform float uWarp, uTravel;
attribute vec2 aGate; // fase, matiz
varying float vEdge, vFade, vHue;
varying vec2 vDir;
void main(){
  float z = mod(aGate.x * 60.0 + uTravel * 0.8, 60.0) - 58.0;
  float dist = max(-z, 0.0);
  float r = length(position.xy);
  vEdge = (r - 0.97) / 0.03;
  vec2 dir = position.xy / r;
  float t = uTravel * 0.05 + aGate.x * 20.0;
  vDir = mat2(cos(t), sin(t), -sin(t), cos(t)) * dir;
  vHue = aGate.y;
  // largura mínima em tela, como nos riscos
  float w = 0.05 + dist * 0.006;
  vec3 p = vec3(dir * (5.6 + vEdge * w), z);
  vFade = (1.0 - smoothstep(16.0, 46.0, dist)) * smoothstep(1.5, 9.0, dist) * smoothstep(0.35, 0.9, uWarp);
  gl_Position = projectionMatrix * vec4(p, 1.0);
}
`;
const gateFrag = /* glsl */ `
varying float vEdge, vFade, vHue;
varying vec2 vDir;
void main(){
  float e = clamp(1.0 - vEdge * vEdge, 0.0, 1.0);
  // arcos interrompidos que giram, em vez de um aro uniforme
  float ang = atan(vDir.y, vDir.x);
  float arc = 0.25 + 0.75 * smoothstep(-0.2, 0.9, sin(ang * 3.0) * 0.6 + sin(ang * 5.0 + 1.7) * 0.4);
  vec3 c = mix(vec3(0.35, 0.95, 0.88), vec3(1.0, 0.86, 0.7), vHue);
  gl_FragColor = vec4(c, e * e * arc * clamp(vFade, 0.0, 1.0) * 0.55);
}
`;
const coreVert = /* glsl */ `
uniform float uWarp;
varying vec2 vP;
void main(){
  vP = position.xy;
  gl_Position = projectionMatrix * vec4(position.xy * (5.0 + 9.0 * uWarp * uWarp) * step(0.001, uWarp), -40.0, 1.0);
}
`;
const coreFrag = /* glsl */ `
uniform float uWarp;
varying vec2 vP;
void main(){
  float g = max(1.0 - length(vP), 0.0);
  float a = (g * g * g * 0.22 + pow(g, 14.0) * 0.6) * uWarp * uWarp;
  gl_FragColor = vec4(mix(vec3(0.3, 0.9, 0.85), vec3(1.0, 0.95, 0.86), g * g * g), a);
}
`;

export function Warp({ intro, mobile }: Props) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const warm = useRef(0);
  const travel = useRef(0);
  const count = mobile ? 420 : 1100;

  const { streaks, gates, core } = useMemo(() => {
    const rnd = prng(7);
    const streak = new Float32Array(count * 4);
    const color = new Float32Array(count * 3);
    const size = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      streak[i * 4] = rnd() * Math.PI * 2;
      streak[i * 4 + 1] = 0.75 + Math.pow(rnd(), 0.8) * 5.2;
      streak[i * 4 + 2] = rnd();
      streak[i * 4 + 3] = 0.7 + rnd() * 0.6;
      const k = rnd();
      color.set(k < 0.6 ? [0.35, 0.95, 0.88] : k < 0.83 ? [0.8, 0.95, 0.93] : [1.0, 0.8, 0.58], i * 3);
      size[i * 2] = 0.014 + rnd() * 0.03;
      size[i * 2 + 1] = 2 + rnd() * 6;
    }
    // segmentos no comprimento para a espiral curvar o risco
    const base = new THREE.PlaneGeometry(1, 1, 1, 6);
    const n = mobile ? 5 : 8;
    const gate = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) gate.set([i / n, i % 3 === 1 ? 1 : 0], i * 2);
    return {
      streaks: instanced(base, count, { aStreak: [streak, 4], aColor: [color, 3], aSize: [size, 2] }),
      gates: instanced(new THREE.RingGeometry(0.94, 1, mobile ? 64 : 96, 2), n, { aGate: [gate, 2] }),
      core: new THREE.PlaneGeometry(2, 2),
    };
  }, [count, mobile]);
  useEffect(
    () => () => {
      streaks.dispose();
      gates.dispose();
      core.dispose();
    },
    [streaks, gates, core],
  );

  const uniforms = useMemo(() => [0, 1, 2].map(() => ({ uWarp: { value: 0 }, uTravel: { value: 0 } })), []);

  useFrame((_, dt) => {
    const s = intro.current;
    if (!s || !group.current) return;
    const w = Math.min(1, Math.max(0, s.warp));
    const on = w > 0.001;
    group.current.visible = on || warm.current < WARMUP;
    if (warm.current < WARMUP) warm.current++;
    travel.current = on ? travel.current + Math.min(dt, 0.05) * (6 + 52 * w * w) : 0;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uWarp.value = on ? w : 0;
      m.uniforms.uTravel.value = travel.current;
    }
  });

  const add = { transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending } as const;
  return (
    <group ref={group}>
      <mesh geometry={core} frustumCulled={false} renderOrder={3}>
        <shaderMaterial ref={(m) => void (mats.current[0] = m)} vertexShader={coreVert} fragmentShader={coreFrag} uniforms={uniforms[0]} {...add} />
      </mesh>
      <mesh geometry={streaks} frustumCulled={false} renderOrder={4}>
        <shaderMaterial ref={(m) => void (mats.current[1] = m)} vertexShader={warpVert} fragmentShader={warpFrag} uniforms={uniforms[1]} {...add} />
      </mesh>
      <mesh geometry={gates} frustumCulled={false} renderOrder={4}>
        <shaderMaterial ref={(m) => void (mats.current[2] = m)} vertexShader={gateVert} fragmentShader={gateFrag} uniforms={uniforms[2]} {...add} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ estilhaços */
const shardVert = /* glsl */ `
uniform float uT, uScale;
attribute vec3 aHome, aVel, aAxis, aSize;
attribute vec2 aRand;
varying vec3 vN, vView;
varying float vSeed, vNear;

vec3 spin(vec3 v, vec3 k, float a){
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

void main(){
  // explode rápido e desacelera; posição é função pura de uT
  float inv = 1.0 - uT;
  float e = 1.0 - inv * inv;
  float life = smoothstep(0.0, 0.05, uT) * (1.0 - smoothstep(0.55 + aRand.x * 0.2, 0.97, uT));
  float ang = aRand.y * 6.2832 + e * (5.0 + aRand.x * 9.0);

  vec3 local = position * aSize * uScale * life;
  vec3 p = spin(local, aAxis, ang);
  vec3 center = vec3(aHome.xy * uScale, aHome.z) + vec3(aVel.xy * mix(uScale, 1.0, 0.35), aVel.z) * e;
  center.y -= 0.7 * uT * uT; // leve gravidade

  vec4 wp = modelMatrix * vec4(center + p, 1.0);
  vN = normalize(mat3(modelMatrix) * spin(normalize(normal / aSize), aAxis, ang));
  vView = cameraPosition - wp.xyz;
  vSeed = aRand.x;
  // some antes de cortar no plano próximo ou cobrir a tela
  vec3 wc = (modelMatrix * vec4(center, 1.0)).xyz;
  vNear = smoothstep(0.35, 1.3, distance(cameraPosition, wc));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const shardFrag = /* glsl */ `
varying vec3 vN, vView;
varying float vSeed, vNear;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(vView);
  float nv = abs(dot(n, v));
  float fres = pow(max(1.0 - nv, 0.0), 2.5);
  vec3 l1 = normalize(vec3(0.5, 0.8, 0.6));
  vec3 l2 = normalize(vec3(-0.7, -0.2, 0.5));
  float d1 = max(dot(n, l1), 0.0);
  float d2 = max(dot(n, l2), 0.0);
  float spec = pow(max(dot(n, normalize(l1 + v)), 0.0), 42.0) + 0.5 * pow(max(dot(n, normalize(l2 + v)), 0.0), 24.0);

  vec3 aqua = vec3(0.35, 0.95, 0.88);
  vec3 sand = vec3(1.0, 0.86, 0.7);
  vec3 white = vec3(0.92, 1.0, 0.98);
  vec3 body = mix(vec3(0.02, 0.16, 0.19), aqua * 0.45, d1) + sand * d2 * 0.12;
  // película iridescente: a cor muda com o ângulo de visão
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (nv * 1.1 + vSeed + vec3(0.0, 0.33, 0.6)));
  vec3 edge = mix(mix(aqua, sand, vSeed), film, 0.45);
  vec3 c = body + edge * fres * 1.1 + film * (0.06 + 0.22 * nv * nv) + white * spec * 0.9;
  gl_FragColor = vec4(min(c, vec3(1.35)), (0.5 + 0.5 * max(fres, min(spec, 1.0))) * vNear);
}
`;

/* Anéis de choque e núcleo de energia: um único desenho com 4 instâncias. */
const waveVert = /* glsl */ `
uniform float uT, uScale;
attribute vec4 aWave; // atraso, raio máximo, inclinação, tipo (0 anel, 1 núcleo)
varying vec2 vP;
varying float vProg, vCore;
void main(){
  vP = position.xy;
  vCore = aWave.w;
  float ring = clamp((uT - aWave.x) / (1.0 - aWave.x), 0.0, 1.0);
  float core = clamp(uT / 0.3, 0.0, 1.0);
  vProg = mix(ring, core, vCore);
  float grow = 1.0 - pow(1.0 - vProg, 2.5);
  // raio zero nos extremos: nada é rasterizado
  float alive = step(0.0001, vProg) * step(vProg, 0.9999);
  float r = aWave.y * mix(grow, 0.35 + 0.65 * grow, vCore) * mix(uScale, 1.0, 0.25) * alive;
  vec3 p = vec3(position.xy * r, 0.0);
  float cx = cos(aWave.z), sx = sin(aWave.z);
  p = vec3(p.x, p.y * cx, p.y * sx);
  float cz = cos(aWave.z * 1.7), sz = sin(aWave.z * 1.7);
  p.xy = mat2(cz, sz, -sz, cz) * p.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const waveFrag = /* glsl */ `
varying vec2 vP;
varying float vProg, vCore;
void main(){
  float d = length(vP);
  float fade = (1.0 - vProg) * (1.0 - vProg);
  vec3 aqua = vec3(0.35, 0.95, 0.88);
  vec3 sand = vec3(1.0, 0.86, 0.7);
  // frente fina na borda e um rastro suave por dentro
  float front = 1.0 - smoothstep(0.0, 0.035, abs(d - 0.93));
  float wake = smoothstep(0.55, 0.93, d) * (1.0 - smoothstep(0.93, 0.97, d));
  float ring = (front * 0.5 + wake * wake * 0.16) * fade * smoothstep(0.0, 0.06, vProg);
  float g = max(1.0 - d, 0.0);
  float core = (g * g * g * 0.28 + pow(g, 9.0) * 0.3) * fade * smoothstep(0.0, 0.12, vProg);
  vec3 c = mix(mix(aqua, sand, front * 0.3), mix(aqua, sand, g * 0.6), vCore);
  gl_FragColor = vec4(c, mix(ring, core, vCore));
}
`;

export function Shatter({ intro, mobile }: Props) {
  const group = useRef<THREE.Group>(null);
  const shardMat = useRef<THREE.ShaderMaterial>(null);
  const waveMat = useRef<THREE.ShaderMaterial>(null);
  const warm = useRef(0);

  const { shards, waves } = useMemo(() => {
    const cols = mobile ? 12 : 20;
    const rows = mobile ? 5 : 7;
    const n = cols * rows;
    const rnd = prng(41);
    const home = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const axis = new Float32Array(n * 3);
    const size = new Float32Array(n * 3);
    const rand = new Float32Array(n * 2);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      // grade com variação: cobre o logotipo sem buracos
      const x = (((i % cols) + 0.15 + rnd() * 0.7) / cols - 0.5) * LOGO_W;
      const y = ((Math.floor(i / cols) + 0.15 + rnd() * 0.7) / rows - 0.5) * LOGO_H;
      home.set([x, y, (rnd() - 0.5) * 0.1], i * 3);
      const th = rnd() * Math.PI * 2;
      if (i % 7 === 3) {
        // rasantes: cruzam o plano da câmera (z = 7) a cerca de 0,9 a 1,7 do eixo
        const r = 0.9 + rnd() * 0.8;
        vel.set([Math.cos(th) * r - x, Math.sin(th) * r - y, 7.5 + rnd() * 2.5], i * 3);
      } else {
        v.set(x * 0.45 + (rnd() - 0.5) * 1.6, y * 2.2 + (rnd() - 0.5) * 2.2, (rnd() - 0.42) * 3.4).normalize();
        v.multiplyScalar(2.2 + rnd() * 4.2);
        vel.set([v.x, v.y, v.z], i * 3);
      }
      v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      axis.set([v.x, v.y, v.z], i * 3);
      const k = 0.6 + rnd() * 0.8;
      size.set([0.06 * k * (0.6 + rnd()), 0.15 * k * (0.7 + rnd() * 0.8), 0.045 * k * (0.6 + rnd())], i * 3);
      rand.set([rnd(), rnd()], i * 2);
    }
    // octaedro com vértices deslocados: facetas irregulares, normais planas
    const base = new THREE.OctahedronGeometry(1, 0);
    const pos = base.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setXYZ(i, pos.getX(i) + y * 0.22, y > 0.5 ? y * 1.25 : y, pos.getZ(i) - y * 0.18);
    }
    base.deleteAttribute("normal");
    base.computeVertexNormals();
    const shardGeo = instanced(base, n, { aHome: [home, 3], aVel: [vel, 3], aAxis: [axis, 3], aSize: [size, 3], aRand: [rand, 2] });

    const wave = new Float32Array([
      0.0, 6.5, 0.12, 0,
      0.1, 5.2, 1.0, 0,
      0.2, 4.2, -0.85, 0,
      0.0, 1.7, 0.0, 1,
    ]);
    const waveGeo = instanced(new THREE.PlaneGeometry(2, 2), 4, { aWave: [wave, 4] });
    return { shards: shardGeo, waves: waveGeo };
  }, [mobile]);
  useEffect(
    () => () => {
      shards.dispose();
      waves.dispose();
    },
    [shards, waves],
  );

  const shardUniforms = useMemo(() => ({ uT: { value: 0 }, uScale: { value: 1 } }), []);
  const waveUniforms = useMemo(() => ({ uT: { value: 0 }, uScale: { value: 1 } }), []);

  useFrame(({ size }) => {
    const s = intro.current;
    const a = shardMat.current?.uniforms;
    const b = waveMat.current?.uniforms;
    if (!s || !a || !b || !group.current) return;
    const t = Math.min(1, Math.max(0, s.shatter));
    const on = t > 0.0001 && t < 0.9999;
    group.current.visible = on || warm.current < WARMUP;
    if (warm.current < WARMUP) warm.current++;
    // mesma conta de uLogoScale das partículas (câmera a 7 unidades, fov 45)
    const visibleW = 2 * 7 * Math.tan((45 * Math.PI) / 360) * (size.width / size.height);
    const scale = Math.min(1, (visibleW * 0.82) / LOGO_W);
    a.uT.value = b.uT.value = t;
    a.uScale.value = b.uScale.value = scale;
  });

  return (
    <group ref={group}>
      <mesh geometry={shards} frustumCulled={false} renderOrder={5}>
        {/* grava profundidade para os cristais se ocluírem corretamente */}
        <shaderMaterial ref={shardMat} vertexShader={shardVert} fragmentShader={shardFrag} uniforms={shardUniforms} transparent depthWrite />
      </mesh>
      <mesh geometry={waves} frustumCulled={false} renderOrder={6}>
        <shaderMaterial ref={waveMat} vertexShader={waveVert} fragmentShader={waveFrag} uniforms={waveUniforms} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
