"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uReveal;
uniform vec2 uRes;
uniform vec2 uMouse;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }

float caustic(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++){
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(max(c, 0.0), 1.4);
  return pow(clamp(abs(c), 0.0, 4.0), 8.0);
}

void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = (uMouse - 0.5) * 0.08;
  float t = uTime * 0.1;

  vec3 abyss = vec3(0.004, 0.06, 0.08);
  vec3 deep  = vec3(0.016, 0.19, 0.23);
  vec3 teal  = vec3(0.06, 0.45, 0.47);

  float n = fbm(p * 1.4 + vec2(t, -t * 0.6) + m);
  float g = smoothstep(-0.15, 1.15, uv.y + (n - 0.5) * 0.35);
  vec3 col = mix(abyss, deep, g);
  col = mix(col, teal, pow(max(g, 0.0), 3.2) * 0.55);

  float c = caustic(p * 0.85 + m * 2.0 + vec2(t * 0.5, t * 0.3), uTime * 0.32);
  col += vec3(0.25, 0.86, 0.8) * c * 0.32 * smoothstep(0.1, 0.95, uv.y);

  float rays = (sin((p.x + uv.y * 0.35 + m.x) * 9.0 + uTime * 0.35) * 0.5 + 0.5);
  rays *= (sin((p.x - uv.y * 0.22) * 14.0 - uTime * 0.27) * 0.5 + 0.5);
  col += vec3(0.25, 0.75, 0.75) * rays * rays * rays * 0.13 * smoothstep(0.35, 1.0, uv.y);

  // brilho quente na superfície (pôr do sol) no canto superior direito
  float sun = exp(-length((uv - vec2(0.82, 1.05)) * vec2(asp * 0.9, 1.6)) * 2.4);
  col += vec3(1.0, 0.55, 0.38) * sun * 0.22;

  float vig = 1.0 - smoothstep(0.3, 1.3, length((uv - 0.5) * vec2(asp * 0.75, 1.0)));
  col *= mix(0.5, 1.0, vig);

  // "Emergir": tudo começa no escuro e uma faixa de luz desce pela tela
  float r = clamp(uReveal, 0.0, 1.0);
  col *= smoothstep(0.0, 1.0, r);
  float bd = (uv.y - (1.25 - r * 1.7)) * 5.0;
  float band = exp(-bd * bd);
  col += vec3(0.35, 0.95, 0.9) * band * 0.22 * (1.0 - r * 0.85) * step(0.001, r);

  // grão sutil
  col += (hash(uv * uRes + uTime) - 0.5) * 0.025;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

function Water({ reveal, mouse }: { reveal: React.RefObject<number>; mouse: React.RefObject<[number, number]> }) {
  const { size } = useThree();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    }),
    [],
  );
  const target = useMemo(() => new THREE.Vector2(0.5, 0.5), []);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uRes.value.set(size.width, size.height);
    u.uTime.value += Math.min(dt, 0.05);
    u.uReveal.value = reveal.current ?? 1;
    const [mx, my] = mouse.current ?? [0.5, 0.5];
    u.uMouse.value.lerp(target.set(mx, my), 0.04);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

const pVert = /* glsl */ `
uniform float uTime;
uniform float uReveal;
attribute float aSeed;
varying float vAlpha;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.08 + aSeed * 0.12) + 4.0, 8.0) - 4.0;
  p.x += sin(uTime * 0.4 + aSeed * 20.0) * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aSeed * 5.0) * (6.0 / -mv.z);
  vAlpha = (0.25 + 0.75 * fract(aSeed * 13.7 + uTime * 0.15)) * uReveal;
}
`;
const pFrag = /* glsl */ `
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(0.6, 1.0, 0.95, a * vAlpha * 0.55);
}
`;

function Plankton({ reveal, count = 700 }: { reveal: React.RefObject<number>; count?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = -Math.random() * 6;
      seed[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uReveal: { value: 0 } }), []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uTime.value += Math.min(dt, 0.05);
    u.uReveal.value = reveal.current ?? 1;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={pVert} fragmentShader={pFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Rig({ mouse }: { mouse: React.RefObject<[number, number]> }) {
  useFrame(({ camera }) => {
    const [mx, my] = mouse.current ?? [0.5, 0.5];
    camera.position.x += ((mx - 0.5) * 0.9 - camera.position.x) * 0.04;
    camera.position.y += ((0.5 - my) * -0.6 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, -3);
  });
  return null;
}

export default function OceanScene({
  reveal,
  mouse,
  active,
  onReady,
}: {
  reveal: React.RefObject<number>;
  mouse: React.RefObject<[number, number]>;
  active: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ position: [0, 0, 3], fov: 55 }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={() => onReady?.()}
      aria-hidden
    >
      <Water reveal={reveal} mouse={mouse} />
      <Plankton reveal={reveal} />
      <Rig mouse={mouse} />
    </Canvas>
  );
}
