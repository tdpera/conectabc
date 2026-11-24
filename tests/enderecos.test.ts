import { describe, expect, it } from "vitest";
import { reverseLocal, searchLocal } from "@/lib/server/enderecos";

describe("endereços de Balneário Camboriú", () => {
  it.each([
    ["Avenida Brasil 1500", "Avenida Brasil, 1500"],
    ["av. brasil, 1500 - centro", "Avenida Brasil, 1500"],
    ["Av Atlântica 2000, Balneário Camboriú - SC", "Avenida Atlântica, 2000"],
    ["Rua 1500, 200", "Rua 1500, 200"],
  ])("%s", (q, label) => {
    const [p] = searchLocal(q);
    expect(p.label).toBe(label);
    expect(p.lat).toBeLessThan(-26.9);
    expect(p.lat).toBeGreaterThan(-27.1);
    expect(p.lng).toBeLessThan(-48.5);
    expect(p.lng).toBeGreaterThan(-48.75);
  });
  it("rua com nome numérico", () => {
    const r = searchLocal("Rua 1500");
    expect(r[0]).toMatchObject({ label: "Rua 1500", precision: "street" });
  });
  it("completa enquanto digita", () => {
    expect(searchLocal("av atla")[0].label).toBe("Avenida Atlântica");
  });
  it("não inventa endereço", () => {
    expect(searchLocal("xyzabc 10")).toEqual([]);
    expect(searchLocal("rua")).toEqual([]);
  });
  it("ida e volta: o ponto de um endereço volta para um endereço no mesmo lugar", () => {
    const [p] = searchLocal("Avenida Brasil 1500");
    const r = reverseLocal(p.lat, p.lng)!;
    expect(r.lat).toBeCloseTo(p.lat, 5);
  });
  it("no mar não há endereço", () => {
    expect(reverseLocal(-26.99, -48.6)).toBeNull();
  });
});
