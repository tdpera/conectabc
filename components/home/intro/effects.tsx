"use client";
/**
 * Pós-processamento da abertura: bloom + lente final (onda de choque, aberração cromática, vinheta).
 * A lente é um ShaderMaterial cru: a cena já escreve cores prontas, sem tone mapping.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { IntroState } from "@/lib/intro-state";

const lens = {
  uniforms: { tDiffuse: { value: null }, uWarp: { value: 0 }, uShock: { value: 0 }, uFlash: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uWarp, uShock, uFlash, uAspect; varying vec2 vUv;
void main(){
  vec2 d = vUv - 0.5;
  float r = length(d * vec2(uAspect, 1.0));
  vec2 dir = d / max(length(d), 1e-4);
  // anel de refração que atravessa a tela na explosão
  float w = (r - uShock * 1.5) * 7.0;
  float ring = exp(-w * w) * step(0.001, uShock) * (1.0 - uShock);
  vec2 uv = vUv - dir * ring * 0.045;
  float ca = 0.0008 + r * r * (uWarp * 0.012 + uFlash * 0.012) + ring * 0.008;
  vec3 c = vec3(texture2D(tDiffuse, uv + dir * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ca).b);
  c += vec3(0.25, 0.8, 0.75) * ring * 0.25;
  c *= 1.0 - smoothstep(0.45, 1.15, r) * (0.22 + uWarp * 0.25);
  gl_FragColor = vec4(c, 1.0);
}`,
};

export function Effects({ intro, mobile }: { intro: React.RefObject<IntroState>; mobile: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
    const composer = new EffectComposer(gl, target);
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.7);
    const last = new ShaderPass(lens);
    const render = new RenderPass(scene, camera);
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(last);
    return { composer, bloom, last, render };
  }, [gl, scene, camera, mobile]);
  useEffect(() => {
    fx.composer.setPixelRatio(gl.getPixelRatio());
    fx.composer.setSize(size.width, size.height);
    // bloom em meia resolução: mais barato e mais macio
    const k = gl.getPixelRatio() * (mobile ? 0.35 : 0.5);
    fx.bloom.setSize(size.width * k, size.height * k);
    fx.last.uniforms.uAspect.value = size.width / size.height;
  }, [fx, gl, size, mobile]);
  useEffect(
    () => () => {
      fx.bloom.dispose();
      fx.last.dispose();
      fx.render.dispose();
      fx.composer.dispose();
    },
    [fx],
  );
  useFrame((_, dt) => {
    const s = intro.current;
    if (!s) return;
    const u = fx.last.uniforms;
    u.uWarp.value = s.warp;
    u.uShock.value = s.shatter;
    u.uFlash.value = s.flash;
    fx.bloom.strength = 0.42 + s.warp * 0.3 + s.flash * 0.5 - s.settle * 0.08;
    fx.composer.render(Math.min(dt, 0.05));
  }, 1);
  return null;
}
