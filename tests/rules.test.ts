import { describe, expect, it } from "vitest";
import { earlySignupOpen, isLaunched, LAUNCH_AT } from "@/lib/launch";
import { formatDistance, haversine } from "@/lib/geo";
import { parseBusiness, subscriptionEntitles, toPublic } from "@/lib/rules";
import { biz } from "./memory-repo";

describe("lançamento", () => {
  it("é 15/01/2027 00:00 em Brasília", () => {
    expect(LAUNCH_AT.toISOString()).toBe("2027-01-15T03:00:00.000Z");
    expect(isLaunched(new Date("2027-01-15T02:59:59Z"))).toBe(false);
    expect(isLaunched(new Date("2027-01-15T03:00:00Z"))).toBe(true);
  });
  it("pausa o cadastro antecipado nas 48h finais", () => {
    expect(earlySignupOpen(new Date("2027-01-13T02:59:00Z"))).toBe(true);
    expect(earlySignupOpen(new Date("2027-01-13T03:00:00Z"))).toBe(false);
  });
});

describe("geo", () => {
  it("calcula distâncias reais", () => {
    const d = haversine({ lat: -26.99, lng: -48.635 }, { lat: -27.0, lng: -48.635 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1234)).toBe("1,2 km");
  });
});

describe("validação de negócio", () => {
  const base = { name: "Café", category: "cafes", city: "BC" };
  it("exige nome, categoria e cidade", () => {
    expect(() => parseBusiness({ ...base, name: "" })).toThrow();
    expect(() => parseBusiness({ ...base, category: "x" })).toThrow();
    expect(() => parseBusiness({ ...base, city: "" })).toThrow();
    expect(parseBusiness(base).name).toBe("Café");
  });
  it("valida o pin", () => {
    expect(() => parseBusiness({ ...base, lat: 91, lng: 0 })).toThrow();
    expect(() => parseBusiness({ ...base, lat: -27, lng: null })).toThrow();
    expect(parseBusiness({ ...base, lat: -27, lng: -48.6 }).lat).toBe(-27);
  });
  it("só aceita capa https", () => {
    expect(() => parseBusiness({ ...base, coverUrl: "http://x.com/a.jpg" })).toThrow();
  });
});

describe("dados públicos", () => {
  it("remove contatos e dono", () => {
    const p = toPublic(biz(1, "u1")) as unknown as Record<string, unknown>;
    for (const k of ["phone", "whatsapp", "instagram", "website", "ownerId"]) expect(p).not.toHaveProperty(k);
  });
});

describe("direito de acesso", () => {
  const after = new Date("2027-02-01T00:00:00Z");
  const sub = (status: string, extra = {}) => ({ status, trialEnd: null, amount: 4999, currency: "brl", ...extra }) as never;
  it("todos têm acesso antes do lançamento", () => expect(subscriptionEntitles(null, new Date("2026-12-01"))).toBe(true));
  it("depois, só assinatura ativa de R$ 49,99 em BRL", () => {
    expect(subscriptionEntitles(null, after)).toBe(false);
    expect(subscriptionEntitles(sub("active"), after)).toBe(true);
    expect(subscriptionEntitles(sub("active", { amount: 100 }), after)).toBe(false);
    expect(subscriptionEntitles(sub("active", { currency: "usd" }), after)).toBe(false);
    for (const s of ["past_due", "unpaid", "canceled", "paused", "incomplete"]) expect(subscriptionEntitles(sub(s), after)).toBe(false);
  });
});
