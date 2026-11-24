import { describe, expect, it } from "vitest";
import * as core from "@/lib/core";
import { biz, memoryRepo } from "./memory-repo";

const BEFORE = new Date("2026-12-01T12:00:00Z");
const AFTER = new Date("2027-02-01T12:00:00Z");

function setup(now = BEFORE, paid: string[] = []) {
  const { repo, db } = memoryRepo({ businesses: [biz(1, "a"), biz(2, "b"), biz(3, "c", { isVisible: false })] });
  const ctx = (userId: string | null): core.Ctx => ({ repo, userId, isAdmin: false, now, isEntitled: async (u) => now < new Date("2027-01-15T03:00:00Z") || paid.includes(u) });
  return { ctx, db };
}

describe("diretório", () => {
  it("visitante vê dados sem contatos antes do lançamento", async () => {
    const r = await core.directory(setup().ctx(null));
    expect(r.full).toBe(false);
    expect(r.businesses).toHaveLength(2);
    expect(r.businesses[0]).not.toHaveProperty("phone");
  });
  it("visitante é bloqueado após o lançamento", async () => {
    expect((await core.directory(setup(AFTER).ctx(null))).locked).toBe(true);
  });
  it("membro sem assinatura vê o paywall; pagante só vê donos pagantes", async () => {
    const s = setup(AFTER, ["a"]);
    expect((await core.directory(s.ctx("b"))).paywalled).toBe(true);
    const r = await core.directory(s.ctx("a"));
    expect(r.businesses.map((b) => b.id)).toEqual(["B1"]);
  });
});

describe("negócio", () => {
  it("uma conta, um negócio (segundo salvamento edita)", async () => {
    const { ctx, db } = setup();
    await core.saveMyBusiness(ctx("a"), { name: "Novo nome", category: "bares", city: "BC" });
    expect(db.businesses.filter((b) => b.ownerId === "a")).toHaveLength(1);
    expect(db.businesses.find((b) => b.ownerId === "a")!.name).toBe("Novo nome");
  });
});

describe("mensagens", () => {
  it("envia, agrupa e marca como lida", async () => {
    const { ctx } = setup();
    await core.sendMessage(ctx("a"), "B2", "Oi!");
    const conv = await core.conversations(ctx("b"));
    expect(conv[0].unread).toBe(1);
    await core.thread(ctx("b"), "B1");
    expect((await core.conversations(ctx("b")))[0].unread).toBe(0);
  });
  it("bloqueia auto-mensagem, negócio oculto, texto vazio ou longo", async () => {
    const { ctx } = setup();
    await expect(core.sendMessage(ctx("a"), "B1", "x")).rejects.toThrow();
    await expect(core.sendMessage(ctx("a"), "B3", "x")).rejects.toThrow();
    await expect(core.sendMessage(ctx("a"), "B2", "   ")).rejects.toThrow();
    await expect(core.sendMessage(ctx("a"), "B2", "x".repeat(2001))).rejects.toThrow();
  });
  it("exige assinatura dos dois lados após o lançamento", async () => {
    const { ctx } = setup(AFTER, ["a"]);
    await expect(core.sendMessage(ctx("a"), "B2", "Oi")).rejects.toThrow(/não está disponível/);
    await expect(core.sendMessage(ctx("b"), "B1", "Oi")).rejects.toThrow(/assinatura/);
  });
});

describe("parcerias", () => {
  const intro = "Vamos trocar indicações de clientes?";
  it("uma proposta viva por par, em qualquer direção", async () => {
    const { ctx } = setup();
    await core.propose(ctx("a"), "B2", "indicacao", intro);
    await expect(core.propose(ctx("a"), "B2", "desconto", intro)).rejects.toThrow(/Já existe/);
    await expect(core.propose(ctx("b"), "B1", "desconto", intro)).rejects.toThrow(/Já existe/);
  });
  it("só o destinatário responde, uma única vez; só o remetente cancela", async () => {
    const { ctx } = setup();
    const p = await core.propose(ctx("a"), "B2", "evento", intro);
    await expect(core.respond(ctx("a"), p.id, true)).rejects.toThrow(/quem recebeu/);
    await expect(core.cancel(ctx("b"), p.id)).rejects.toThrow(/quem enviou/);
    expect((await core.respond(ctx("b"), p.id, true)).status).toBe("accepted");
    await expect(core.respond(ctx("b"), p.id, false)).rejects.toThrow(/já foi respondida/);
    await expect(core.cancel(ctx("a"), p.id)).rejects.toThrow();
  });
  it("após recusa, permite nova proposta", async () => {
    const { ctx } = setup();
    const p = await core.propose(ctx("a"), "B2", "outro", intro);
    await core.respond(ctx("b"), p.id, false);
    await expect(core.propose(ctx("a"), "B2", "outro", intro)).resolves.toBeTruthy();
  });
  it("valida tipo e apresentação", async () => {
    const { ctx } = setup();
    await expect(core.propose(ctx("a"), "B2", "xxx", intro)).rejects.toThrow();
    await expect(core.propose(ctx("a"), "B2", "outro", "curta")).rejects.toThrow();
  });
});
