import { describe, expect, it } from "vitest";
import * as core from "@/lib/core";
import { csvCell, weekly } from "@/lib/admin";
import { biz, memoryRepo } from "./memory-repo";

const P = (id: string, createdAt: string, isAdmin = false) => ({ id, email: `${id}@t.com`, name: id, isAdmin, createdAt });
function ctx(isAdmin: boolean): core.Ctx {
  const { repo } = memoryRepo({
    businesses: [biz(1, "a")],
    profiles: [P("a", "2026-11-01T00:00:00Z"), P("b", "2026-11-20T00:00:00Z"), P("root", "2026-10-01T00:00:00Z", true)],
    subs: [{ userId: "a", status: "trialing", currentPeriodEnd: null, trialEnd: null, amount: 4999, currency: "brl" }],
  });
  return { repo, userId: "x", isAdmin, now: new Date("2026-11-24T12:00:00Z"), isEntitled: async () => true };
}

describe("painel administrativo", () => {
  it("só administradores acessam", async () => {
    await expect(core.adminStats(ctx(false), [], "unset")).rejects.toThrow("Acesso restrito");
  });
  it("inclui contas sem negócio, mais recentes primeiro, e deixa o administrador de fora", async () => {
    const s = await core.adminStats(ctx(true), [], "unset");
    expect(s.rows.map((r) => r.userId)).toEqual(["b", "a"]);
    expect(s.rows[0].business).toBeNull();
    expect(s.rows[1].subscription).toBe("trialing");
    expect([s.totalAccounts, s.totalBusinesses]).toEqual([2, 1]);
  });
  it("agrupa cadastros por semana", () => {
    const now = new Date("2026-11-24T12:00:00Z");
    const w = weekly(["2026-11-24T01:00:00Z", "2026-11-18T00:00:00Z", "2026-11-10T00:00:00Z", "2020-01-01T00:00:00Z", null], now, 4);
    expect(w.map((x) => x.count)).toEqual([0, 1, 0, 2]);
  });
  it("CSV neutraliza fórmulas e escapa aspas", () => {
    expect(csvCell("=1+1")).toBe("\"'=1+1\"");
    expect(csvCell('a "b"')).toBe('"a ""b"""');
  });
});
