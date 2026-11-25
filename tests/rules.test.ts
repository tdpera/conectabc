import { describe, expect, it } from "vitest";
import { addMonth, checkoutTrialEnd, normalizeCode } from "@/lib/plan";
import { formatDistance, haversine } from "@/lib/geo";
import { parseBusiness, subscriptionEntitles, toPublic } from "@/lib/rules";
import { biz } from "./memory-repo";

describe("plano", () => {
  it("um mês de calendário, sem estourar fevereiro", () => {
    expect(addMonth(new Date("2027-01-31T10:00:00Z")).toISOString()).toBe("2027-02-28T10:00:00.000Z");
    expect(addMonth(new Date("2026-12-10T10:00:00Z")).toISOString()).toBe("2027-01-10T10:00:00.000Z");
  });
  it("normaliza códigos", () => {
    expect(normalizeCode(" a3-f9c2 ")).toBe("A3F9C2");
    for (const c of ["", "abc", "1234567", null]) expect(normalizeCode(c)).toBeNull();
  });
  it("cobrança só depois do mês grátis, respeitando as 48 h do Stripe", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    expect(checkoutTrialEnd(null, now)).toBeNull();
    expect(checkoutTrialEnd({ freeUntil: "2026-11-30T00:00:00Z" }, now)).toBeNull();
    expect(checkoutTrialEnd({ freeUntil: "2026-12-20T00:00:00Z" }, now)!.toISOString()).toBe("2026-12-20T00:00:00.000Z");
    expect(checkoutTrialEnd({ freeUntil: "2026-12-01T05:00:00Z" }, now)!.toISOString()).toBe("2026-12-03T01:00:00.000Z");
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
  it("só assinatura ativa de R$ 49,99 em BRL", () => {
    expect(subscriptionEntitles(null, after)).toBe(false);
    expect(subscriptionEntitles(sub("active"), after)).toBe(true);
    expect(subscriptionEntitles(sub("active", { amount: 100 }), after)).toBe(false);
    expect(subscriptionEntitles(sub("active", { currency: "usd" }), after)).toBe(false);
    expect(subscriptionEntitles(sub("trialing", { trialEnd: "2027-02-10T00:00:00Z" }), after)).toBe(true);
    expect(subscriptionEntitles(sub("trialing", { trialEnd: "2027-01-10T00:00:00Z" }), after)).toBe(false);
    for (const s of ["past_due", "unpaid", "canceled", "paused", "incomplete"]) expect(subscriptionEntitles(sub(s), after)).toBe(false);
  });
});
