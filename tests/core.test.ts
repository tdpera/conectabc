import { describe, expect, it } from "vitest";
import * as core from "@/lib/core";
import { freeActive } from "@/lib/plan";
import type { Membership } from "@/lib/types";
import { biz, memoryRepo } from "./memory-repo";

const NOW = new Date("2026-12-01T12:00:00Z");
const member = (userId: string, freeUntil: string | null, i = 0, referredCode: string | null = null): Membership => ({
  userId, freeUntil, founderNumber: freeUntil ? i + 1 : null, referralCode: `CODE0${i}`, referredCode,
});
const FREE = "2026-12-20T00:00:00Z";

/** `free`: quem está no mês grátis. */
function setup(free: string[] = ["a", "b", "c"]) {
  const all = ["a", "b", "c"];
  const { repo, db } = memoryRepo({
    now: NOW,
    businesses: [biz(1, "a"), biz(2, "b"), biz(3, "c", { isVisible: false })],
    members: all.map((u, i) => member(u, free.includes(u) ? FREE : "2026-11-20T00:00:00Z", i)),
  });
  const ctx = (userId: string | null, isAdmin = false): core.Ctx => ({
    repo, userId, isAdmin, now: NOW, isEntitled: async (u) => freeActive(db.members.find((m) => m.userId === u), NOW),
  });
  return { ctx, db };
}

describe("diretório", () => {
  it("visitante vê o mapa sem contatos", async () => {
    const r = await core.directory(setup().ctx(null));
    expect([r.full, r.paywalled, r.businesses.length]).toEqual([false, false, 2]);
    expect(r.businesses[0]).not.toHaveProperty("phone");
  });
  it("quem está sem acesso some do mapa e vê só a versão pública", async () => {
    const s = setup(["a"]);
    const r = await core.directory(s.ctx("b"));
    expect([r.full, r.paywalled]).toEqual([false, true]);
    expect(r.businesses.map((b) => b.id)).toEqual(["B1"]);
    expect(r.businesses[0]).not.toHaveProperty("phone");
    expect((await core.directory(s.ctx("a"))).businesses[0]).toHaveProperty("phone");
    expect(await core.businessById(s.ctx(null), "B2")).toBeNull();
    expect(await core.businessById(s.ctx("b"), "B1")).not.toHaveProperty("phone");
    expect(await core.businessById(s.ctx("b"), "B2")).toHaveProperty("phone"); // o próprio
  });
});

describe("mês grátis e indicação", () => {
  const input = { name: "Novo", category: "bares", city: "BC" };
  it("cada conta ganha um mês, uma única vez", async () => {
    const { ctx, db } = setup();
    await core.saveMyBusiness(ctx("z"), input);
    await core.saveMyBusiness(ctx("z"), input);
    const m = db.members.filter((x) => x.userId === "z");
    expect(m).toHaveLength(1);
    expect(m[0].freeUntil).toBe("2027-01-01T12:00:00.000Z");
    expect(db.used).toBe(1);
  });
  it("o 101º entra sem mês grátis", async () => {
    const { ctx, db } = setup();
    db.used = 99;
    await core.saveMyBusiness(ctx("y"), input);
    await core.saveMyBusiness(ctx("z"), input);
    expect(db.members.find((m) => m.userId === "y")!.founderNumber).toBe(100);
    expect(db.members.find((m) => m.userId === "z")!.freeUntil).toBeNull();
    expect((await core.offer(ctx(null))).left).toBe(0);
  });
  it("administrador não gasta vaga", async () => {
    const { ctx, db } = setup();
    await core.saveMyBusiness(ctx("z", true), input);
    expect(db.used).toBe(0);
  });
  it("aceita código de membro e recusa inválido sem gastar vaga", async () => {
    const { ctx, db } = setup();
    expect(await core.checkReferral(ctx(null), "code 00")).toEqual({ businessName: "Negócio 1" });
    expect(await core.checkReferral(ctx("a"), "CODE00")).toBeNull(); // o próprio código
    await expect(core.saveMyBusiness(ctx("z"), input, "XXXXXX")).rejects.toThrow(/indicação/);
    expect(db.used).toBe(0);
    await core.saveMyBusiness(ctx("z"), input, "code00");
    expect(db.members.find((m) => m.userId === "z")!.referredCode).toBe("CODE00");
  });
  it("código não pode ser acrescentado depois", async () => {
    const { ctx, db } = setup();
    await core.saveMyBusiness(ctx("b"), input, "CODE00");
    expect(db.members.find((m) => m.userId === "b")!.referredCode).toBeNull();
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
  it("exige acesso ativo dos dois lados", async () => {
    const { ctx } = setup(["a"]);
    await expect(core.sendMessage(ctx("a"), "B2", "Oi")).rejects.toThrow(/não está disponível/);
    await expect(core.sendMessage(ctx("b"), "B1", "Oi")).rejects.toThrow(/acesso/);
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
