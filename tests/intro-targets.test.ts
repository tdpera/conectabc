import { describe, expect, it } from "vitest";
import { fitPoints, pillarsFrom, vbToWorld } from "@/lib/intro-targets";
import { decorativePins, project, VB } from "@/lib/bay";

describe("abertura 3D", () => {
  it("mapeia o viewBox para o chão com a baía perto da origem", () => {
    expect(vbToWorld(330, 380)).toEqual([0, 0]);
    const [x0, z0] = vbToWorld(0, 0);
    const [x1, z1] = vbToWorld(VB.w, VB.h);
    expect(x0).toBeLessThan(0);
    expect(z0).toBeLessThan(0); // norte para −Z
    expect(x1).toBeGreaterThan(0);
    expect(z1).toBeGreaterThan(0);
  });

  it("pilares seguem a mesma projeção dos pins e têm altura estável", () => {
    const [x, y] = project(-26.9915, -48.6352);
    const pins = [{ id: "b-01", name: "Café", category: "cafes", x, y }, { id: "b-02", name: "Hotel", category: "hoteis", x: x + 10, y }];
    const a = pillarsFrom(pins);
    const b = pillarsFrom(pins);
    expect(a).toEqual(b);
    expect([a[0].x, a[0].z]).toEqual(vbToWorld(x, y));
    for (const p of a) {
      expect(p.h).toBeGreaterThan(0.3);
      expect(p.h).toBeLessThan(2);
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.delay).toBeLessThanOrEqual(1);
    }
  });

  it("pilares de pins decorativos ficam dentro da área do mapa", () => {
    for (const p of pillarsFrom(decorativePins(30))) {
      expect(Math.abs(p.x)).toBeLessThan(4);
      expect(Math.abs(p.z)).toBeLessThan(4);
    }
  });

  it("completa o número de partículas a partir das amostras", () => {
    const s = new Float32Array([1, 2, 3, 4, 5, 6]);
    const out = fitPoints(s, 10);
    expect(out.length).toBe(30);
    expect(Array.from(out.slice(0, 6))).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < 10; i++) expect(Math.abs(out[i * 3] - 1) < 0.02 || Math.abs(out[i * 3] - 4) < 0.02).toBe(true);
    expect(fitPoints(new Float32Array(), 5).every((v) => v === 0)).toBe(true);
  });
});
