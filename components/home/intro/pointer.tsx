"use client";
/**
 * Reatividade ao mouse/toque da abertura 3D.
 * - usePointerField: escuta o herói (passivo) e preenche o PointerState;
 * - pointerUniforms / updatePointerUniforms / pointerGLSL: campo para as partículas;
 * - PointerFX: cometa, orbe com faíscas e onda de choque nos toques.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { IntroState, PointerState } from "@/lib/intro-state";

type Ref<T> = React.RefObject<T>;

const MAX_TAPS = 6;
const NO_TAP = 99;
const TAP_LIFE = 1.7;
const IDLE_AFTER = 3;
const nowS = () => performance.now() / 1000;
const clamp = THREE.MathUtils.clamp;
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/* ------------------------------------------------------------------ entrada */
/** Dados que o PointerState não guarda: se o ponteiro está presente e quando se moveu. */
interface Presence {
  inside: boolean;
  lastMove: number;
  /** Posição exata do dedo/cursor: a luz a segue sem atraso; x/y do PointerState movem a câmera. */
  fx: number;
  fy: number;
  /** Muda a cada contato novo: o campo renasce ali em vez de riscar a tela. */
  contact: number;
}
const presence = new WeakMap<PointerState, Presence>();
function presenceOf(p: PointerState) {
  let m = presence.get(p);
  if (!m) {
    m = { inside: false, lastMove: -NO_TAP, fx: 0.5, fy: 0.5, contact: 0 };
    presence.set(p, m);
  }
  return m;
}

const INTERACTIVE = "a,button,input,select,textarea,label,[role='button']";
const TAP_SLOP = 10;
const TAP_TIME = 0.5;

export function usePointerField(root: Ref<HTMLElement | null>, pointer: Ref<PointerState>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    let lastFrame = 0;
    let px = 0.5;
    let py = 0.5;
    // mira: para onde x/y caminham (no toque) ou posição imediata (no mouse)
    let tx = 0.5;
    let ty = 0.5;
    let cx = 0;
    let cy = 0;
    let haveClient = false;
    // gesto em andamento
    let id = -1;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let travel = 0;
    let ignore = false;
    let dragging = false;
    let releasedAt = 0;

    const read = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      tx = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
      ty = clamp((clientY - r.top) / Math.max(1, r.height), 0, 1);
      const m = presenceOf(pointer.current);
      m.fx = tx;
      m.fy = ty;
    };

    const frame = (ms: number) => {
      raf = 0;
      const p = pointer.current;
      const dt = clamp((ms - lastFrame) / 1000, 0.001, 0.05);
      lastFrame = ms;
      let busy = false;
      if (p.touch) {
        if (dragging) {
          const k = damp(16, dt);
          p.x += (tx - p.x) * k;
          p.y += (ty - p.y) * k;
          busy = true;
        } else if (id === -1) {
          // solta o dedo: volta devagar ao centro
          const wait = ms / 1000 - releasedAt < 0.35;
          const k = wait ? 0 : damp(1.7, dt);
          p.x += (0.5 - p.x) * k;
          p.y += (0.5 - p.y) * k;
          busy = wait || Math.abs(p.x - 0.5) + Math.abs(p.y - 0.5) > 0.002;
        }
      } else {
        p.x = tx;
        p.y = ty;
      }
      // o retorno ao centro não conta como gesto, portanto não gera velocidade
      const live = !p.touch || dragging;
      const k = damp(14, dt);
      p.vx += ((live ? clamp((p.x - px) / dt, -8, 8) : 0) - p.vx) * k;
      p.vy += ((live ? clamp((p.y - py) / dt, -8, 8) : 0) - p.vy) * k;
      px = p.x;
      py = p.y;
      if (Math.abs(p.vx) + Math.abs(p.vy) > 0.004) busy = true;
      else p.vx = p.vy = 0;
      if (busy) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf) return;
      lastFrame = performance.now() - 16;
      raf = requestAnimationFrame(frame);
    };

    const enterAt = (p: PointerState) => {
      // primeira aparição: sem salto, logo sem velocidade falsa
      p.x = px = tx;
      p.y = py = ty;
      p.vx = p.vy = 0;
      presenceOf(p).contact++;
    };

    const move = (e: PointerEvent) => {
      const p = pointer.current;
      const m = presenceOf(p);
      const touch = e.pointerType === "touch";
      if (touch) {
        if (e.pointerId !== id) return;
        travel = Math.max(travel, Math.hypot(e.clientX - sx, e.clientY - sy));
        if (ignore) return;
        read(e.clientX, e.clientY);
        m.lastMove = nowS();
        if (!dragging) {
          if (Math.abs(e.clientX - sx) < TAP_SLOP || Math.abs(e.clientX - sx) < Math.abs(e.clientY - sy)) return;
          dragging = true;
          p.vx = p.vy = 0;
          px = p.x;
          py = p.y;
        }
      } else {
        if (!e.isPrimary) return;
        if (e.pointerId === id) travel = Math.max(travel, Math.hypot(e.clientX - sx, e.clientY - sy));
        cx = e.clientX;
        cy = e.clientY;
        haveClient = true;
        read(cx, cy);
        if (!m.inside || p.touch) enterAt(p);
      }
      p.touch = touch;
      p.active = true;
      m.inside = true;
      m.lastMove = nowS();
      wake();
    };

    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) {
        // segundo dedo (pinça) cancela o toque
        if (e.pointerType === "touch") travel = TAP_SLOP * 2;
        return;
      }
      const p = pointer.current;
      const touch = e.pointerType === "touch";
      ignore = !!(e.target as Element | null)?.closest?.(INTERACTIVE);
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      st = nowS();
      travel = 0;
      dragging = false;
      p.down = true;
      p.touch = touch;
      if (touch) {
        // a luz acende sob o dedo já no contato; a câmera só gira se houver arrasto
        const m = presenceOf(p);
        haveClient = false;
        m.inside = !ignore;
        if (!ignore) {
          read(sx, sy);
          m.lastMove = st;
          m.contact++;
        }
      }
      if (!ignore) p.active = true;
    };

    const release = (p: PointerState, touch: boolean) => {
      id = -1;
      dragging = false;
      p.down = false;
      releasedAt = nowS();
      if (touch) presenceOf(p).inside = false;
      wake();
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const p = pointer.current;
      travel = Math.max(travel, Math.hypot(e.clientX - sx, e.clientY - sy));
      const t = nowS();
      const inRoot = e.target instanceof Node && el.contains(e.target);
      if (!ignore && inRoot && travel < TAP_SLOP && t - st < TAP_TIME) {
        const r = el.getBoundingClientRect();
        // reaproveita o registro mais antigo quando o anel está cheio
        const tap = p.taps.length >= MAX_TAPS ? p.taps.shift()! : { x: 0, y: 0, t: 0 };
        tap.x = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
        tap.y = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1);
        tap.t = t;
        p.taps.push(tap);
        p.active = true;
        if (e.pointerType !== "touch") presenceOf(p).lastMove = t;
      }
      release(p, e.pointerType === "touch");
    };

    const cancel = (e: PointerEvent) => {
      if (e.pointerId === id) release(pointer.current, e.pointerType === "touch");
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      presenceOf(pointer.current).inside = false;
      haveClient = false;
      wake();
    };
    const blur = () => {
      const p = pointer.current;
      presenceOf(p).inside = false;
      haveClient = false;
      release(p, p.touch);
    };
    // a página rolou sob um mouse parado: o retângulo mudou
    const scroll = () => {
      if (!haveClient || pointer.current.touch) return;
      read(cx, cy);
      wake();
    };

    // pan-y: o navegador cuida da rolagem vertical e nos entrega o arrasto horizontal
    const touchAction = el.style.touchAction;
    el.style.touchAction = "pan-y pinch-zoom";
    const o = { passive: true } as const;
    el.addEventListener("pointermove", move, o);
    el.addEventListener("pointerdown", down, o);
    el.addEventListener("pointerleave", leave, o);
    window.addEventListener("pointerup", up, o);
    window.addEventListener("pointercancel", cancel, o);
    window.addEventListener("blur", blur);
    window.addEventListener("scroll", scroll, o);
    return () => {
      cancelAnimationFrame(raf);
      el.style.touchAction = touchAction;
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
      window.removeEventListener("scroll", scroll);
    };
  }, [root, pointer]);
}

/* ------------------------------------------------------------------ uniforms */
export function pointerUniforms() {
  return {
    uPtr: { value: new THREE.Vector3() },
    uPtrVel: { value: new THREE.Vector3() },
    uPtrOn: { value: 0 },
    /** 0 = plano frontal (z=0), 1 = chão (y=0): define o eixo do redemoinho. */
    uPtrTilt: { value: 0 },
    uTaps: { value: Array.from({ length: MAX_TAPS }, () => new THREE.Vector4(0, 0, 0, NO_TAP)) },
  };
}
export type PointerUniforms = ReturnType<typeof pointerUniforms>;

/** Estado interno por conjunto de uniforms; a chave é o array uTaps, que sobrevive a um spread. */
interface FieldState {
  lastTap: number;
  slot: number;
  contact: number;
  ground: Float32Array;
}
const fields = new WeakMap<THREE.Vector4[], FieldState>();
function fieldOf(taps: THREE.Vector4[]) {
  let f = fields.get(taps);
  if (!f) {
    f = { lastTap: nowS() - 0.3, slot: 0, contact: 0, ground: new Float32Array(MAX_TAPS) };
    fields.set(taps, f);
  }
  return f;
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit = new THREE.Vector3();
const FAR = 16;

/** Raio da câmera em (x, y) 0..1; a inversa da projeção já inclui o setViewOffset. */
function castRay(camera: THREE.Camera, x: number, y: number) {
  _o.setFromMatrixPosition(camera.matrixWorld);
  _d.set(x * 2 - 1, 1 - y * 2, 0.5).unproject(camera).sub(_o).normalize();
}
const frontT = () => (_d.z < -1e-3 && _o.z > 0 ? Math.min(FAR, -_o.z / _d.z) : FAR);
const groundT = () => (_d.y < -1e-3 && _o.y > 0 ? Math.min(FAR, -_o.y / _d.y) : FAR);

export function updatePointerUniforms(u: PointerUniforms, camera: THREE.Camera, pointer: Ref<PointerState>, intro: Ref<IntroState>, dt: number) {
  const p = pointer.current;
  const s = intro.current;
  if (!p || !s) return;
  const h = clamp(dt, 0.001, 0.05);
  const t = nowS();
  const m = presenceOf(p);
  camera.updateMatrixWorld();

  const raw = clamp(s.tilt, 0, 1);
  const tilt = raw * raw * (3 - 2 * raw);
  u.uPtrTilt.value = tilt;

  // os dois planos são misturados ao longo do mesmo raio: o ponto fica sempre sob o cursor
  castRay(camera, m.fx, m.fy);
  const a = frontT();
  _hit.copy(_o).addScaledVector(_d, a + (groundT() - a) * tilt);

  const present = m.inside && (p.down || t - m.lastMove < IDLE_AFTER);
  const target = present ? 1 - clamp(s.scroll * 1.5, 0, 1) : 0;
  const pos = u.uPtr.value;
  const vel = u.uPtrVel.value;
  const f = fieldOf(u.uTaps.value);
  const fresh = f.contact !== m.contact;
  f.contact = m.contact;
  if (fresh) u.uPtrOn.value = 0;
  if (u.uPtrOn.value < 0.01) {
    // apagado: reaparece já no lugar, sem riscar a tela
    pos.copy(_hit);
    vel.set(0, 0, 0);
  } else {
    const k = damp(34, h);
    // velocidade = passo suavizado desta atualização
    _hit.sub(pos).multiplyScalar(k);
    pos.add(_hit);
    _hit.multiplyScalar(1 / h).clampLength(0, 12);
    vel.lerp(_hit, damp(14, h));
  }
  u.uPtrOn.value += (target - u.uPtrOn.value) * damp(target > u.uPtrOn.value ? 16 : 4, h);
  if (u.uPtrOn.value < 0.002 && target === 0) u.uPtrOn.value = 0;

  const taps = u.uTaps.value;
  for (let i = 0; i < taps.length; i++) taps[i].w = Math.min(NO_TAP, taps[i].w + h + (taps[i].w > 4 ? NO_TAP : 0));
  for (let i = 0; i < p.taps.length; i++) {
    const tap = p.taps[i];
    if (tap.t <= f.lastTap) continue;
    f.lastTap = tap.t;
    if (t - tap.t > 0.5) continue;
    // o ponto do toque é congelado no mundo no instante em que chega
    castRay(camera, tap.x, tap.y);
    const ground = s.settle > 0.5;
    _hit.copy(_o).addScaledVector(_d, ground ? groundT() : frontT());
    taps[f.slot].set(_hit.x, _hit.y, _hit.z, t - tap.t);
    f.ground[f.slot] = ground ? 1 : 0;
    f.slot = (f.slot + 1) % MAX_TAPS;
  }
}

export const pointerGLSL = /* glsl */ `
uniform vec3 uPtr;
uniform vec3 uPtrVel;
uniform float uPtrOn;
uniform float uPtrTilt;
uniform vec4 uTaps[${MAX_TAPS}];
// Deslocamento (somar a p, em coordenadas de mundo).
vec3 pointerDisplace(vec3 p, float seed){
  vec3 d = p - uPtr;
  float r2 = dot(d, d);
  float f = exp(-r2 * 1.3) * uPtrOn;
  vec3 n = d / sqrt(r2 + 0.05);
  vec3 axis = normalize(mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), uPtrTilt));
  float speed = min(length(uPtrVel) * 0.16, 1.0);
  vec3 o = n * f * (0.16 + 0.22 * speed) * (0.6 + 0.8 * seed);
  o += cross(axis, n) * f * (0.12 + 0.3 * speed) * (0.5 + seed);
  o += uPtrVel * f * 0.028 * seed;
  o += axis * f * (seed - 0.35) * 0.22;
  for (int i = 0; i < ${MAX_TAPS}; i++) {
    vec4 tp = uTaps[i];
    if (tp.w < 3.0) {
      vec3 e = p - tp.xyz;
      float l = sqrt(dot(e, e) + 0.01);
      float band = (l - (0.1 + 3.4 * (1.0 - exp(-1.5 * tp.w)))) / 0.38;
      float amp = exp(-band * band) * exp(-2.0 * tp.w) * smoothstep(0.0, 0.06, tp.w);
      o += (e / l * 0.5 + axis * 0.4 * (0.4 + seed)) * amp;
    }
  }
  return o;
}
`;

/* ------------------------------------------------------------------ efeitos no canvas */
// fita: nós da trilha em uniform, largura voltada para a câmera
const ribbonVert = (n: number) => /* glsl */ `
uniform vec3 uTrail[${n}];
attribute float aI;
attribute float aSide;
varying float vT;
varying float vS;
void main(){
  int i = int(aI + 0.5);
  vec3 p = uTrail[i];
  vec3 tan0 = uTrail[max(i - 1, 0)] - uTrail[min(i + 1, ${n - 1})];
  vec3 view = cameraPosition - p;
  float dist = max(length(view), 0.001);
  vec3 side = cross(tan0, view / dist);
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(0.0);
  vT = aI / ${(n - 1).toFixed(1)};
  vS = aSide;
  float w = 0.085 * pow(1.0 - vT, 1.4) * dist / 7.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(p + side * aSide * w, 1.0);
}
`;
const ribbonFrag = /* glsl */ `
uniform float uOn;
uniform float uSpeed;
varying float vT;
varying float vS;
void main(){
  float e = clamp(1.0 - abs(vS), 0.0, 1.0); // MSAA pode extrapolar os varyings
  float k = clamp(1.0 - vT, 0.0, 1.0);
  float a = (e * e * 0.55 + smoothstep(0.75, 1.0, e) * 0.25) * k * k;
  vec3 c = mix(vec3(0.55, 0.98, 0.92), mix(vec3(0.12, 0.6, 0.75), vec3(1.0, 0.58, 0.42), smoothstep(0.45, 1.0, vT) * 0.6), smoothstep(0.0, 0.6, vT));
  gl_FragColor = vec4(c, a * uOn * uSpeed);
}
`;

// quads voltados para a câmera: 0 = orbe, 1 = faísca em órbita, 2 = faísca de explosão
const sparkVert = /* glsl */ `
uniform vec3 uPtr;
uniform float uPtrOn;
uniform float uPtrTilt;
uniform float uTime;
uniform float uSpeed;
uniform float uDown;
uniform vec4 uTaps[${MAX_TAPS}];
uniform float uTapGround[${MAX_TAPS}];
attribute float aKind;
attribute vec4 aRnd;
attribute float aTap;
varying vec2 vUv;
varying float vA;
varying float vKind;
varying float vTint;
void main(){
  vUv = uv * 2.0 - 1.0;
  vKind = aKind;
  vTint = aRnd.w;
  vec3 c = uPtr;
  float size = 0.0;
  vA = 0.0;
  if (aKind < 0.5) {
    size = 0.17 * (1.0 + 0.08 * sin(uTime * 3.0) + uSpeed * 0.3 - uDown * 0.25) * uPtrOn;
    vA = uPtrOn;
  } else if (aKind < 1.5) {
    float ang = uTime * (1.4 + aRnd.x * 2.2) * (aRnd.y > 0.5 ? 1.0 : -1.0) + aRnd.z * 6.283;
    float rad = (0.13 + aRnd.x * 0.14) * (1.0 + uSpeed * 0.8 - uDown * 0.4);
    float inc = (aRnd.w - 0.5) * 2.6 + uPtrTilt * 1.2;
    vec3 q = vec3(cos(ang), sin(ang), 0.0) * rad;
    c += vec3(q.x, q.y * cos(inc), q.y * sin(inc)) * uPtrOn;
    size = 0.02 * (0.6 + aRnd.z * 0.6) * uPtrOn;
    vA = 0.85 * uPtrOn;
  } else {
    int k = int(aTap + 0.5);
    vec4 tp = uTaps[k];
    float g = uTapGround[k];
    float life = 0.7 + aRnd.w * 0.8;
    float q = tp.w / life;
    if (q < 1.0) {
      float ang = aRnd.x * 6.283;
      float up = aRnd.y * 2.0 - 1.0;
      float flat0 = sqrt(max(0.0, 1.0 - up * up));
      vec3 front = vec3(cos(ang) * flat0, sin(ang) * flat0, up * 0.7);
      vec3 ground = vec3(cos(ang) * flat0, abs(up) * 1.5 + 0.35, sin(ang) * flat0);
      float reach = (0.5 + aRnd.z * 1.1) * (1.0 - exp(-3.2 * tp.w)) * clamp(distance(cameraPosition, tp.xyz) / 7.0, 1.0, 2.2);
      c = tp.xyz + mix(front, ground, g) * reach;
      c.y -= 0.75 * tp.w * tp.w;
      // no chão as faíscas pousam, sem atravessar a água
      c.y = mix(c.y, max(c.y, 0.01), g);
      size = 0.034 * (0.5 + aRnd.z) * (1.0 - q);
      vA = (1.0 - q) * 0.9;
    }
  }
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * size * max(-mv.z, 0.1) / 7.0;
  gl_Position = projectionMatrix * mv;
}
`;
const sparkFrag = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vA;
varying float vKind;
varying float vTint;
void main(){
  float d = length(vUv);
  float f = max(0.0, 1.0 - d);
  vec3 c = mix(vec3(0.4, 0.95, 0.88), vec3(1.0, 0.72, 0.52), step(0.72, vTint));
  float a;
  if (vKind < 0.5) {
    // halo + núcleo + anel fino; intensidade contida por causa do bloom
    float ring = smoothstep(0.07, 0.0, abs(d - 0.5 - 0.03 * sin(uTime * 2.2)));
    a = f * f * 0.3 + smoothstep(0.2, 0.0, d) * 0.4 + ring * 0.16;
    c = mix(vec3(0.25, 0.85, 0.82), vec3(0.8, 1.0, 0.96), smoothstep(0.3, 0.0, d));
  } else {
    a = f * f * 0.85;
  }
  gl_FragColor = vec4(c, a * vA);
}
`;

// onda de choque: disco subdividido com relevo real, deitado no chão ou de frente
const waveVert = /* glsl */ `
uniform vec4 uTaps[${MAX_TAPS}];
uniform float uTapGround[${MAX_TAPS}];
uniform float uScale;
attribute float aTap;
varying float vR;
varying float vAge;
varying float vH;
float bump(float x){ return exp(-x * x); }
void main(){
  int k = int(aTap + 0.5);
  vec4 tp = uTaps[k];
  float g = uTapGround[k];
  vAge = tp.w;
  vR = length(position.xy);
  float front = 0.95 * (1.0 - exp(-2.2 * tp.w));
  float fade = exp(-1.6 * tp.w);
  vH = (bump((vR - front) / 0.07) - 0.6 * bump((vR - front + 0.15) / 0.08) + 0.5 * bump((vR - front + 0.28) / 0.08)) * fade;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 fwd = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  right = mix(right, vec3(1.0, 0.0, 0.0), g);
  up = mix(up, vec3(0.0, 0.0, -1.0), g);
  fwd = mix(fwd, vec3(0.0, 1.0, 0.0), g);
  // toques longe da câmera (topo da tela no celular) mantêm o tamanho aparente
  float far = clamp(distance(cameraPosition, tp.xyz) / 7.0, 1.0, 2.2);
  vec3 w = tp.xyz + far * ((right * position.x + up * position.y) * uScale + fwd * (max(vH, -0.02) * 0.3 + 0.025));
  // instância parada vira um ponto fora da tela
  gl_Position = tp.w < ${TAP_LIFE.toFixed(1)} ? projectionMatrix * viewMatrix * vec4(w, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const waveFrag = /* glsl */ `
varying float vR;
varying float vAge;
varying float vH;
float bump(float x){ return exp(-x * x); }
void main(){
  float front = 0.95 * (1.0 - exp(-2.2 * vAge));
  float a = bump((vR - front) / 0.022) * 0.55;
  a += bump((vR - front + 0.15) / 0.02) * 0.3;
  a += bump((vR - front + 0.28) / 0.018) * 0.18;
  a += max(vH, 0.0) * 0.12 + bump(vR / 0.12) * exp(-7.0 * vAge) * 0.4;
  a *= (1.0 - smoothstep(0.85, 1.0, vR)) * (1.0 - smoothstep(0.9, ${TAP_LIFE.toFixed(1)}, vAge));
  vec3 c = mix(vec3(0.2, 0.8, 0.78), vec3(0.75, 1.0, 0.95), clamp(vH, 0.0, 1.0) * 0.6);
  gl_FragColor = vec4(c, a);
}
`;

function buildFX(mobile: boolean) {
  const trailN = mobile ? 18 : 28;
  const orbitN = mobile ? 8 : 14;
  const burstN = mobile ? 16 : 30;
  const ptr = pointerUniforms();
  const trail = Array.from({ length: trailN }, () => new THREE.Vector3());
  const uTime = { value: 0 };
  const uSpeed = { value: 0 };
  const uDown = { value: 0 };
  const uTapGround = { value: fieldOf(ptr.uTaps.value).ground };
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } as const;

  // fita
  const ribbon = new THREE.BufferGeometry();
  const aI = new Float32Array(trailN * 2);
  const aSide = new Float32Array(trailN * 2);
  const index: number[] = [];
  for (let i = 0; i < trailN; i++) {
    aI[i * 2] = aI[i * 2 + 1] = i;
    aSide[i * 2] = -1;
    aSide[i * 2 + 1] = 1;
    if (i < trailN - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  ribbon.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trailN * 6), 3));
  ribbon.setAttribute("aI", new THREE.BufferAttribute(aI, 1));
  ribbon.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  ribbon.setIndex(index);
  const ribbonMat = new THREE.ShaderMaterial({
    vertexShader: ribbonVert(trailN), fragmentShader: ribbonFrag, depthTest: false,
    uniforms: { uTrail: { value: trail }, uOn: ptr.uPtrOn, uSpeed }, ...common,
  });

  // orbe + faíscas numa única chamada
  const total = 1 + orbitN + burstN * MAX_TAPS;
  const kind = new Float32Array(total);
  const rnd = new Float32Array(total * 4);
  const tapOf = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    kind[i] = i === 0 ? 0 : i <= orbitN ? 1 : 2;
    tapOf[i] = i > orbitN ? (i - 1 - orbitN) % MAX_TAPS : 0;
    for (let j = 0; j < 4; j++) rnd[i * 4 + j] = Math.random();
  }
  const quad = new THREE.PlaneGeometry(2, 2);
  const sparks = new THREE.InstancedBufferGeometry();
  sparks.setIndex(quad.index);
  sparks.setAttribute("position", quad.attributes.position);
  sparks.setAttribute("uv", quad.attributes.uv);
  sparks.setAttribute("aKind", new THREE.InstancedBufferAttribute(kind, 1));
  sparks.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 4));
  sparks.setAttribute("aTap", new THREE.InstancedBufferAttribute(tapOf, 1));
  sparks.instanceCount = total;
  const sparksMat = new THREE.ShaderMaterial({
    vertexShader: sparkVert, fragmentShader: sparkFrag, depthTest: false,
    uniforms: { uPtr: ptr.uPtr, uPtrOn: ptr.uPtrOn, uPtrTilt: ptr.uPtrTilt, uTaps: ptr.uTaps, uTapGround, uTime, uSpeed, uDown }, ...common,
  });

  // ondas
  const disc = new THREE.RingGeometry(0.001, 1, mobile ? 40 : 72, mobile ? 14 : 28);
  const wave = new THREE.InstancedBufferGeometry();
  wave.setIndex(disc.index);
  wave.setAttribute("position", disc.attributes.position);
  wave.setAttribute("aTap", new THREE.InstancedBufferAttribute(Float32Array.from({ length: MAX_TAPS }, (_, i) => i), 1));
  wave.instanceCount = MAX_TAPS;
  const waveMat = new THREE.ShaderMaterial({
    vertexShader: waveVert, fragmentShader: waveFrag,
    uniforms: { uTaps: ptr.uTaps, uTapGround, uScale: { value: mobile ? 1.5 : 2.1 } }, ...common,
  });

  const group = new THREE.Group();
  const waves = new THREE.Mesh(wave, waveMat);
  const ribbons = new THREE.Mesh(ribbon, ribbonMat);
  const points = new THREE.Mesh(sparks, sparksMat);
  [waves, ribbons, points].forEach((m, i) => {
    m.frustumCulled = false;
    m.renderOrder = 20 + i;
    // o rastro não deve interceptar o raycaster do R3F
    m.raycast = () => {};
    group.add(m);
  });

  let warm = 2;
  let wasOn = false;
  let contact = 0;
  const step = (camera: THREE.Camera, pointer: Ref<PointerState>, intro: Ref<IntroState>, rawDt: number) => {
    const p = pointer.current;
    if (!p || !intro.current) return;
    const dt = clamp(rawDt, 0.001, 0.05);
    updatePointerUniforms(ptr, camera, pointer, intro, dt);
    const field = fieldOf(ptr.uTaps.value);
    if (field.contact !== contact) {
      contact = field.contact;
      wasOn = false;
      uSpeed.value = 0;
    }
    const on = ptr.uPtrOn.value > 0.003;
    let tapsOn = false;
    for (let i = 0; i < MAX_TAPS; i++) if (ptr.uTaps.value[i].w < TAP_LIFE) tapsOn = true;
    // cadeia: cada nó persegue o anterior; ao reaparecer, recolhe tudo na ponta
    if (on) {
      trail[0].copy(ptr.uPtr.value);
      const k = damp(42, dt);
      for (let i = trailN - 1; i > 0; i--) {
        if (wasOn) trail[i].lerp(trail[i - 1], k);
        else trail[i].copy(trail[0]);
      }
    }
    wasOn = on;
    uTime.value = (uTime.value + dt) % 1000;
    // a fita só aparece em movimento, e apaga mais devagar do que acende
    const speed = clamp(ptr.uPtrVel.value.length() * 0.3, 0, 1);
    uSpeed.value += (speed - uSpeed.value) * damp(speed > uSpeed.value ? 12 : 3, dt);
    uDown.value += ((p.down ? 1 : 0) - uDown.value) * damp(14, dt);
    // os primeiros quadros são desenhados (vazios) só para compilar os shaders
    const warming = warm > 0;
    if (warming) warm--;
    ribbons.visible = warming || (on && uSpeed.value > 0.01);
    points.visible = warming || on || tapsOn;
    waves.visible = warming || tapsOn;
    group.visible = ribbons.visible || points.visible || waves.visible;
  };
  const dispose = () => {
    for (const r of [ribbon, ribbonMat, sparks, sparksMat, wave, waveMat, quad, disc]) r.dispose();
  };
  return { group, step, dispose };
}

export function PointerFX({ intro, pointer, mobile }: { intro: Ref<IntroState>; pointer: Ref<PointerState>; mobile: boolean }) {
  const fx = useMemo(() => buildFX(mobile), [mobile]);
  useEffect(() => () => fx.dispose(), [fx]);
  useFrame(({ camera }, dt) => fx.step(camera, pointer, intro, dt));
  return <primitive object={fx.group} />;
}
