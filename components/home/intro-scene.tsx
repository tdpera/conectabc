"use client";
/**
 * Abertura 3D "Partículas → Skyline": partículas formam o logotipo, explodem,
 * pousam na baía; pilares de luz sobem em cada negócio e arcos os conectam.
 * Toda a coreografia é dirigida pelo objeto `intro` (animado pelo GSAP no herói).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Water } from "./ocean-scene";
import { category } from "@/lib/categories";
import { buildNetwork, type BayPin } from "@/lib/bay";
import { coastPoints, logoPoints, pillarsFrom, type Pillar } from "@/lib/intro-targets";

import type { IntroState, PointerState } from "@/lib/intro-state";
import { Warp, Shatter } from "./intro/spectacle";
import { City } from "./intro/city";
import { PointerFX, pointerGLSL, pointerUniforms, updatePointerUniforms } from "./intro/pointer";
import { Effects } from "./intro/effects";
export type { IntroState };

type Ref<T> = React.RefObject<T>;

/* ------------------------------------------------------------------ partículas */
const partVert = /* glsl */ `
${pointerGLSL}
uniform float uTime, uLogo, uBurst, uCoast, uFlash, uReveal, uLogoScale, uPR;
attribute vec3 aCloud;
attribute vec3 aLogo;
attribute float aDelay;
attribute float aSeed;
attribute float aKind;
varying float vAlpha;
varying vec3 vColor;

float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) * 0.5; }

void main(){
  float pl = ease(clamp(uLogo * 1.45 - aDelay * 0.45, 0.0, 1.0));
  float pc = ease(clamp(uCoast * 1.55 - aDelay * 0.55, 0.0, 1.0));

  vec3 cloud = aCloud + vec3(sin(uTime*0.23 + aSeed*6.28), cos(uTime*0.19 + aSeed*9.1), sin(uTime*0.17 + aSeed*4.0)) * 0.35;
  vec3 logo = aLogo * uLogoScale;
  logo.y += sin(uTime * 1.6 + aLogo.x * 1.4) * 0.02;
  vec3 p = mix(cloud, logo, pl);

  // explosão a partir do logotipo
  vec3 dir = normalize(vec3(aLogo.xy, 0.0) + (vec3(aSeed, fract(aSeed*7.13), fract(aSeed*3.7)) - 0.5) * vec3(1.6, 1.6, 4.0) + 1e-4);
  p += dir * uBurst * (1.2 + aSeed * 3.2) * (1.0 - pc);

  // pousa na baía (posição = atributo padrão)
  p = mix(p, position, pc);

  // redemoinho no meio do trajeto
  float transit = pl * (1.0 - pl) * 4.0 + pc * (1.0 - pc) * 4.0;
  p += vec3(
    sin(aSeed * 40.0 + uTime * 1.3 + p.y * 2.0),
    cos(aSeed * 31.0 + uTime * 1.1 + p.x * 2.0) * 0.6,
    sin(aSeed * 17.0 + uTime * 0.9 + p.z * 2.0)
  ) * 0.32 * transit;

  // o ponteiro empurra e gira as partículas
  p += pointerDisplace(p, aSeed);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float coastLine = step(0.9, aKind) * pc;
  float size = (1.1 + aSeed * 1.7) * (1.0 + uFlash * 0.4) * (1.0 + coastLine * 0.6);
  float nearFade = smoothstep(0.5, 2.0, -mv.z); // partícula colada na câmera viraria um borrão gigante
  gl_PointSize = min(size * uPR * (7.0 / max(-mv.z, 0.1)), 14.0 * uPR);

  float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + aSeed * 50.0);
  vAlpha = nearFade * uReveal * mix(0.28, 1.0, max(pl, pc)) * mix(1.0, twinkle, pc) * mix(1.0, 0.55 + aKind * 0.45, pc);
  vec3 white = vec3(0.92, 1.0, 0.98);
  vec3 aqua = vec3(0.35, 0.95, 0.88);
  vec3 sand = vec3(1.0, 0.86, 0.7);
  vColor = mix(mix(aqua, white, pl), mix(aqua * 0.8, sand, step(0.9, aKind) * 0.25), pc);
  vColor *= 1.0 - 0.65 * uBurst * (1.0 - pc); // deixa os cristais aparecerem na explosão
}
`;
const partFrag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

function Particles({ intro, pointer, count, logo, coast }: { intro: Ref<IntroState>; pointer: Ref<PointerState>; count: number; logo: Float32Array; coast: { pos: Float32Array; kind: Float32Array } }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size, gl } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const cloud = new Float32Array(count * 3);
    const delay = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      cloud[i * 3] = r * Math.sin(ph) * Math.cos(th);
      cloud[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
      cloud[i * 3 + 2] = r * Math.cos(ph) - 1.5;
      delay[i] = Math.random();
      seed[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(coast.pos, 3));
    g.setAttribute("aCloud", new THREE.BufferAttribute(cloud, 3));
    g.setAttribute("aLogo", new THREE.BufferAttribute(logo, 3));
    g.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aKind", new THREE.BufferAttribute(coast.kind, 1));
    return g;
  }, [count, logo, coast]);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uLogo: { value: 0 }, uBurst: { value: 0 }, uCoast: { value: 0 }, uFlash: { value: 0 }, uReveal: { value: 0 }, uLogoScale: { value: 1 }, uPR: { value: 1 }, ...pointerUniforms() }),
    [],
  );
  useFrame(({ camera }, dt) => {
    const u = mat.current?.uniforms;
    const s = intro.current;
    if (!u || !s) return;
    updatePointerUniforms(u as unknown as ReturnType<typeof pointerUniforms>, camera, pointer, intro, Math.min(dt, 0.05));
    u.uTime.value += Math.min(dt, 0.05);
    u.uLogo.value = s.logo;
    u.uBurst.value = s.burst;
    u.uCoast.value = s.coast;
    u.uFlash.value = s.flash;
    u.uReveal.value = Math.min(1, s.reveal * 1.4);
    // logotipo cabe na tela também no celular (largura visível a 7 unidades de distância)
    const visibleW = 2 * 7 * Math.tan((45 * Math.PI) / 360) * (size.width / size.height);
    u.uLogoScale.value = Math.min(1, (visibleW * 0.82) / 5);
    u.uPR.value = gl.getPixelRatio() * (size.height / 900) * 1.6;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={partVert} fragmentShader={partFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/* ------------------------------------------------------------------ grade do chão */
const gridFrag = /* glsl */ `
uniform float uGrid, uTime;
varying vec2 vUv;
varying vec3 vW;
void main(){
  vec2 g = abs(fract(vW.xz * 2.0) - 0.5);
  float line = smoothstep(0.03, 0.0, min(g.x, g.y));
  float fade = smoothstep(5.5, 0.5, length(vW.xz));
  float scan = exp(-pow((length(vW.xz) - mod(uTime * 1.2, 9.0)) * 3.0, 2.0)) * 0.6;
  gl_FragColor = vec4(vec3(0.25, 0.85, 0.8), (line * 0.16 + scan * line) * fade * uGrid);
}
`;
const gridVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vW;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;

function Grid({ intro }: { intro: Ref<IntroState> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uGrid: { value: 0 }, uTime: { value: 0 } }), []);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u || !intro.current) return;
    u.uGrid.value = intro.current.grid;
    u.uTime.value += Math.min(dt, 0.05);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.005}>
      <planeGeometry args={[14, 14]} />
      <shaderMaterial ref={mat} vertexShader={gridVert} fragmentShader={gridFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ pilares de luz */
const pillarVert = /* glsl */ `
uniform float uRise, uTime, uHot;
attribute vec3 aOffset;
attribute float aHeight, aDelay, aIndex;
attribute vec3 aColor;
varying vec3 vColor;
varying float vY, vHot, vFres, vR;
float riseOf(){ float r = clamp(uRise * 1.7 - aDelay * 0.7, 0.0, 1.0); return 1.0 - pow(1.0 - r, 3.0); }
void main(){
  float r = riseOf();
  vR = r;
  vec3 p = position;
  float hot = step(abs(aIndex - uHot), 0.5);
  vHot = hot;
  float w = 1.0 + hot * 0.6;
  p.xz *= w;
  p.y *= aHeight * r * (1.0 + hot * 0.15);
  vY = position.y;
  vec4 wp = modelMatrix * vec4(p + aOffset, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 v = normalize(cameraPosition - wp.xyz);
  vFres = pow(1.0 - abs(dot(n, v)), 2.0);
  vColor = aColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const pillarFrag = /* glsl */ `
uniform float uTime, uHot;
varying vec3 vColor;
varying float vY, vHot, vFres, vR;
void main(){
  float dimmed = (uHot >= 0.0 && vHot < 0.5) ? 0.45 : 1.0;
  float grad = 0.35 + 0.65 * smoothstep(0.0, 1.0, vY) + 0.5 * smoothstep(0.08, 0.0, vY);
  float band = 0.15 * smoothstep(0.02, 0.0, abs(fract(vY * 6.0 - uTime * 0.6) - 0.5) - 0.45);
  vec3 c = mix(vColor, vec3(1.0), 0.08 + vFres * 0.25 + vHot * 0.4);
  float a = (0.26 + vFres * 0.3 + band) * grad * dimmed * step(0.001, vR); // aditivo + bloom: contido para não estourar em branco
  gl_FragColor = vec4(c * (1.0 + vHot * 0.8), a);
}
`;

const capVert = /* glsl */ `
uniform float uRise, uTime, uHot, uPR;
attribute float aHeight, aDelay, aIndex;
attribute vec3 aColor;
varying vec3 vColor;
varying float vA;
void main(){
  float r = clamp(uRise * 1.7 - aDelay * 0.7, 0.0, 1.0); r = 1.0 - pow(1.0 - r, 3.0);
  float hot = step(abs(aIndex - uHot), 0.5);
  vec3 p = position; p.y = aHeight * r * (1.0 + hot * 0.15) + 0.02;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = 0.85 + 0.15 * sin(uTime * 3.0 + aDelay * 20.0);
  gl_PointSize = (10.0 + hot * 14.0) * pulse * uPR * (6.0 / -mv.z);
  vColor = mix(aColor, vec3(1.0), 0.55);
  vA = step(0.02, r);
}
`;
const capFrag = /* glsl */ `
varying vec3 vColor; varying float vA;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor, a * a * vA * 0.7); }
`;

const ringVert = /* glsl */ `
attribute vec3 aOffset; attribute float aDelay; attribute vec3 aColor;
varying vec2 vUv; varying float vD; varying vec3 vColor;
void main(){ vUv = uv; vD = aDelay; vColor = aColor; vec4 wp = modelMatrix * vec4(position + aOffset, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const ringFrag = /* glsl */ `
uniform float uRise, uTime;
varying vec2 vUv; varying float vD; varying vec3 vColor;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float start = clamp(uRise * 1.7 - vD * 0.7, 0.0, 1.0);
  float shock = step(0.001, start) * (1.0 - start);
  float rad = fract(uTime * 0.35 + vD);
  float ring = smoothstep(0.08, 0.0, abs(d - rad)) * (1.0 - rad) * 0.6 * step(0.999, start);
  float boom = smoothstep(0.12, 0.0, abs(d - start)) * shock * 1.4;
  float base = smoothstep(0.25, 0.0, d) * 0.5 * step(0.001, start);
  gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.4), (ring + boom + base));
}
`;

function Pillars({ intro, pillars, hot }: { intro: Ref<IntroState>; pillars: Pillar[]; hot: Ref<number> }) {
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const group = useRef<THREE.Group>(null);
  const { gl, size } = useThree();
  const { body, caps, rings } = useMemo(() => {
    const n = pillars.length;
    const offset = new Float32Array(n * 3);
    const height = new Float32Array(n);
    const delay = new Float32Array(n);
    const index = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const c = new THREE.Color();
    pillars.forEach((p, i) => {
      offset.set([p.x, 0, p.z], i * 3);
      height[i] = p.h;
      delay[i] = p.delay;
      index[i] = i;
      c.set(category(p.category).hue[0]);
      color.set([c.r, c.g, c.b], i * 3);
    });
    const inst = (g: THREE.BufferGeometry) => {
      const ig = new THREE.InstancedBufferGeometry().copy(g as THREE.InstancedBufferGeometry);
      ig.instanceCount = n;
      ig.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 3));
      ig.setAttribute("aHeight", new THREE.InstancedBufferAttribute(height, 1));
      ig.setAttribute("aDelay", new THREE.InstancedBufferAttribute(delay, 1));
      ig.setAttribute("aIndex", new THREE.InstancedBufferAttribute(index, 1));
      ig.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
      return ig;
    };
    const cyl = new THREE.CylinderGeometry(0.03, 0.045, 1, 10, 1, true).translate(0, 0.5, 0);
    const ring = new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2);
    // as "tampas" são pontos: uma geometria de pontos com os mesmos atributos
    const capGeo = new THREE.BufferGeometry();
    capGeo.setAttribute("position", new THREE.BufferAttribute(offset.slice(), 3));
    capGeo.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
    capGeo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    capGeo.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    capGeo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    return { body: inst(cyl), caps: capGeo, rings: inst(ring) };
  }, [pillars]);
  const uniforms = useMemo(() => [0, 1, 2].map(() => ({ uRise: { value: 0 }, uTime: { value: 0 }, uHot: { value: -1 }, uPR: { value: 1 } })), []);
  useFrame((_, dt) => {
    const s = intro.current;
    if (!s) return;
    if (group.current) group.current.visible = s.rise > 0; // senão as tampas flutuam sobre o logotipo
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uRise.value = s.rise;
      m.uniforms.uTime.value += Math.min(dt, 0.05);
      m.uniforms.uHot.value = hot.current ?? -1;
      m.uniforms.uPR.value = gl.getPixelRatio() * (size.height / 900) * 1.4;
    }
  });
  if (!pillars.length) return null;
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  return (
    <group ref={group} visible={false}>
      <mesh geometry={rings} frustumCulled={false} position-y={0.004}>
        <shaderMaterial ref={(m) => { mats.current[0] = m; }} vertexShader={ringVert} fragmentShader={ringFrag} uniforms={uniforms[0]} {...common} />
      </mesh>
      <mesh geometry={body} frustumCulled={false}>
        <shaderMaterial ref={(m) => { mats.current[1] = m; }} vertexShader={pillarVert} fragmentShader={pillarFrag} uniforms={uniforms[1]} side={THREE.DoubleSide} {...common} />
      </mesh>
      <points geometry={caps} frustumCulled={false}>
        <shaderMaterial ref={(m) => { mats.current[2] = m; }} vertexShader={capVert} fragmentShader={capFrag} uniforms={uniforms[2]} {...common} />
      </points>
    </group>
  );
}

/* ------------------------------------------------------------------ arcos */
const arcVert = /* glsl */ `
attribute float aDelay, aA, aB;
varying float vT, vD, vHot, vDim;
uniform float uHot;
void main(){
  vT = uv.x; vD = aDelay;
  float isHot = step(abs(aA - uHot), 0.5) + step(abs(aB - uHot), 0.5);
  vHot = min(isHot, 1.0);
  vDim = (uHot >= 0.0 && vHot < 0.5) ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const arcFrag = /* glsl */ `
uniform float uDraw, uTime;
varying float vT, vD, vHot, vDim;
void main(){
  float draw = clamp(uDraw * 1.6 - vD * 0.6, 0.0, 1.0);
  float vis = smoothstep(draw, draw - 0.05, vT) * step(0.001, draw);
  float ph = fract(vT - uTime * 0.32 + vD * 7.0) - 0.5;
  float pulse = exp(-ph * ph * 320.0) * step(0.999, draw);
  float head = exp(-pow((vT - draw) * 30.0, 2.0)) * step(0.001, draw) * (1.0 - step(0.999, draw));
  vec3 c = mix(vec3(0.25, 0.85, 0.8), vec3(1.0, 0.86, 0.72), vT);
  float a = vis * (0.28 + vHot * 0.6) * (1.0 - vDim * 0.75) + (pulse + head) * (1.0 - vDim * 0.7);
  gl_FragColor = vec4(c + (pulse + head) * 0.8, a);
}
`;

function Arcs({ intro, pillars, pins, hot }: { intro: Ref<IntroState>; pillars: Pillar[]; pins: BayPin[]; hot: Ref<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    if (pillars.length < 2) return null;
    const idx = new Map(pillars.map((p, i) => [p.id, i]));
    const parts: THREE.BufferGeometry[] = [];
    buildNetwork(pins).forEach((e, k) => {
      const ia = idx.get(e.a.id)!;
      const ib = idx.get(e.b.id)!;
      const A = pillars[ia];
      const B = pillars[ib];
      const a = new THREE.Vector3(A.x, A.h, A.z);
      const b = new THREE.Vector3(B.x, B.h, B.z);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.25 + a.distanceTo(b) * 0.55;
      const tube = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 32, 0.007, 5, false);
      const n = tube.attributes.position.count;
      const d = ((k * 0.618) % 1) * 0.9;
      tube.setAttribute("aDelay", new THREE.BufferAttribute(new Float32Array(n).fill(d), 1));
      tube.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(n).fill(ia), 1));
      tube.setAttribute("aB", new THREE.BufferAttribute(new Float32Array(n).fill(ib), 1));
      tube.deleteAttribute("normal");
      parts.push(tube);
    });
    return mergeGeometries(parts);
  }, [pillars, pins]);
  const uniforms = useMemo(() => ({ uDraw: { value: 0 }, uTime: { value: 0 }, uHot: { value: -1 } }), []);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u || !intro.current) return;
    u.uDraw.value = intro.current.draw;
    u.uTime.value += Math.min(dt, 0.05);
    u.uHot.value = hot.current ?? -1;
  });
  if (!geo) return null;
  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={arcVert} fragmentShader={arcFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ câmera + hover */
const FRONT = new THREE.Vector3(0, 0, 7);
const FRONT_LOOK = new THREE.Vector3(0, 0, 0);
const AERIAL = new THREE.Vector3(1.4, 4.4, 5.6);
const AERIAL_LOOK = new THREE.Vector3(0.15, 0.2, -0.35);
const smooth = (t: number) => t * t * (3 - 2 * t);

function Rig({
  intro, mouse, pointer, pillars, hot, onHover, interactive,
}: {
  intro: Ref<IntroState>; mouse: Ref<[number, number]>; pointer: Ref<PointerState>; pillars: Pillar[]; hot: Ref<number>; onHover: (p: Pillar | null) => void; interactive: boolean;
}) {
  const { camera, size } = useThree();
  const m = useRef(new THREE.Vector2(0.5, 0.5));
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const target2 = useMemo(() => new THREE.Vector2(), []);
  const last = useRef(-1);
  const moved = useRef<string | null>(null);
  useFrame((_, dt) => {
    const s = intro.current;
    if (!s) return;
    const [mx, my] = mouse.current ?? [0.5, 0.5];
    // só mostra rótulos depois que a pessoa mexer o mouse
    const key = `${mx.toFixed(3)},${my.toFixed(3)}`;
    if (moved.current === null) moved.current = key;
    const pointerActive = moved.current !== key;
    if (pointerActive) moved.current = "moved";
    m.current.lerp(target2.set(mx, my), 1 - Math.exp(-Math.min(dt, 0.05) * 5));
    const t = smooth(Math.min(1, Math.max(0, s.tilt)));
    pos.lerpVectors(FRONT, AERIAL, t);
    look.lerpVectors(FRONT_LOOK, AERIAL_LOOK, t);
    // voo rasante: no meio da inclinação a câmera desce e contorna a cidade
    const swoop = Math.sin(Math.PI * t);
    pos.y -= swoop * 1.15;
    // logotipo: entra girando, para revelar o volume das letras
    const spin = (1 - smooth(Math.min(1, s.logo))) * 0.7 * (1 - t);
    // órbita suave com o mouse depois que a cena assenta
    const yaw = (m.current.x - 0.5) * 0.42 * s.settle + (m.current.x - 0.5) * 0.45 * (1 - s.settle) - swoop * 1.05 + spin;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const dx = pos.x - look.x;
    const dz = pos.z - look.z;
    pos.x = look.x + dx * cos - dz * sin;
    pos.z = look.z + dx * sin + dz * cos;
    pos.y += (m.current.y - 0.5) * -0.8 * s.settle;
    // afastamento com o scroll
    pos.y += s.scroll * 2.6;
    pos.z += s.scroll * 1.8;
    camera.position.copy(pos);
    // campo de visão abre no túnel e "soca" na explosão
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 45 + s.warp * 22 + s.flash * 5;
    camera.lookAt(look);

    // enquadramento: no desktop a baía vai para a direita; no celular, para baixo
    const w = size.width;
    const h = size.height;
    const desktop = w >= 1024;
    const ox = desktop ? -w * 0.34 * s.settle : 0;
    const oy = desktop ? 0 : -h * 0.3 * s.settle;
    (camera as THREE.PerspectiveCamera).setViewOffset(w, h, ox, oy, w, h);

    // hover: pilar mais próximo do cursor, em pixels
    let best = -1;
    const ptr = pointer.current;
    let hx = mx;
    let hy = my;
    let canHover = moved.current === "moved";
    // no toque não existe hover: vale o último toque, por um instante
    if (ptr?.touch) {
      const tap = ptr.taps[ptr.taps.length - 1];
      canHover = !!tap && performance.now() / 1000 - tap.t < 1.5;
      if (tap) {
        hx = tap.x;
        hy = tap.y;
      }
    }
    if (interactive && canHover && s.settle > 0.9 && s.scroll < 0.2) {
      let bd = ptr?.touch ? 36 * 36 : 30 * 30;
      pillars.forEach((p, i) => {
        tmp.set(p.x, p.h * 0.7, p.z).project(camera);
        const sx = (tmp.x * 0.5 + 0.5) * w;
        const sy = (-tmp.y * 0.5 + 0.5) * h;
        const d = (sx - hx * w) ** 2 + (sy - hy * h) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
    }
    hot.current = best;
    if (best !== last.current) {
      last.current = best;
      onHover(best >= 0 ? pillars[best] : null);
    }
  });
  return null;
}

function Label({ pillar }: { pillar: Pillar | null }) {
  if (!pillar) return null;
  const c = category(pillar.category);
  return (
    <Html position={[pillar.x, pillar.h + 0.18, pillar.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="glass-dark whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
        {c.emoji} {pillar.name}
      </div>
    </Html>
  );
}

/* ------------------------------------------------------------------ cena */
function Scene({
  intro, mouse, pointer, pins, count, mobile, interactive, onReady, onHover,
}: {
  intro: Ref<IntroState>; mouse: Ref<[number, number]>; pointer: Ref<PointerState>; mobile: boolean; pins: BayPin[]; count: number; interactive: boolean; onReady: () => void; onHover: (id: string | null) => void;
}) {
  const reveal = useRef(0);
  const hot = useRef(-1);
  const [targets, setTargets] = useState<{ logo: Float32Array; coast: { pos: Float32Array; kind: Float32Array } } | null>(null);
  const [label, setLabel] = useState<Pillar | null>(null);
  const pillars = useMemo(() => pillarsFrom(pins), [pins]);
  const readySent = useRef(false);

  useEffect(() => {
    let alive = true;
    logoPoints(count).then((logo) => {
      if (alive) setTargets({ logo, coast: coastPoints(count) });
    });
    return () => {
      alive = false;
    };
  }, [count]);

  useFrame(() => {
    reveal.current = intro.current?.reveal ?? 1;
    const p = pointer.current;
    const m = mouse.current;
    if (p && m) {
      m[0] = p.x;
      m[1] = p.y;
    }
    if (targets && !readySent.current) {
      readySent.current = true;
      requestAnimationFrame(onReady);
    }
  });

  return (
    <>
      <Water reveal={reveal} mouse={mouse} />
      <Grid intro={intro} />
      {targets && <Particles intro={intro} pointer={pointer} count={count} logo={targets.logo} coast={targets.coast} />}
      <Warp intro={intro} mobile={mobile} />
      <Shatter intro={intro} mobile={mobile} />
      <City intro={intro} pillars={pillars} mobile={mobile} />
      <Pillars intro={intro} pillars={pillars} hot={hot} />
      <Arcs intro={intro} pillars={pillars} pins={pins} hot={hot} />
      <Rig
        pointer={pointer}
        intro={intro}
        mouse={mouse}
        pillars={pillars}
        hot={hot}
        interactive={interactive}
        onHover={(p) => {
          setLabel(p);
          onHover(p?.id ?? null);
        }}
      />
      <PointerFX intro={intro} pointer={pointer} mobile={mobile} />
      <Label pillar={label} />
      <Effects intro={intro} mobile={mobile} />
    </>
  );
}

export default function IntroScene(props: {
  intro: Ref<IntroState>;
  mouse: Ref<[number, number]>;
  pointer: Ref<PointerState>;
  pins: BayPin[];
  active: boolean;
  interactive: boolean;
  onReady: () => void;
  onHover: (id: string | null) => void;
}) {
  const count = useMemo(() => {
    if (typeof window === "undefined") return 6000;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return window.matchMedia("(max-width: 768px)").matches || (mem && mem < 4) ? 6000 : 18000;
  }, []);
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={props.active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0, 7], fov: 45, near: 0.1, far: 60 }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Scene intro={props.intro} mouse={props.mouse} pointer={props.pointer} mobile={count <= 6000} pins={props.pins} count={count} interactive={props.interactive} onReady={props.onReady} onHover={props.onHover} />
    </Canvas>
  );
}
