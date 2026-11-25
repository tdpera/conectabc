/** Migração 0005 no Postgres real (PGlite): vagas, códigos e permissões. */
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let db: PGlite;
type Row = { user_id: string; founder_number: number | null; free_until: Date | null; referral_code: string; referred_code: string | null };
const claim = async (n: number, code: string | null = null, founder = true) => {
  await db.exec("set role service_role");
  try {
    return (await db.query<Row>("select * from public.claim_membership($1, $2, $3)", [id(n), code, founder])).rows[0];
  } finally {
    await db.exec("reset role");
  }
};
const used = async () => (await db.query<{ used: number }>("select used from public.founder_offer")).rows[0].used;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth to anon, authenticated, service_role;`);
  for (const f of ["0001_schema", "0002_rls", "0003_functions", "0004_grants", "0005_memberships"])
    await db.exec(readFileSync(path.join(__dirname, `../supabase/migrations/${f}.sql`), "utf8").replace(/create extension[^;]+;/i, ""));
  for (let i = 1; i <= 110; i++) await db.query("insert into auth.users (id, email) values ($1, $2)", [id(i), `u${i}@t.com`]);
}, 60000);

describe("vagas e indicação no banco", () => {
  it("dá um mês de calendário, numera e é idempotente", async () => {
    const a = await claim(1);
    expect(a.founder_number).toBe(1);
    expect(a.referral_code).toMatch(/^[A-Z0-9]{6}$/);
    const days = (new Date(a.free_until!).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(31.1);
    expect((await claim(1)).referral_code).toBe(a.referral_code);
    expect(await used()).toBe(1);
  });
  it("código válido fica registrado; inválido não gasta vaga", async () => {
    const a = await claim(1);
    expect((await claim(2, ` ${a.referral_code.toLowerCase()} `)).referred_code).toBe(a.referral_code);
    await expect(claim(3, "ZZZZZZ")).rejects.toThrow(/codigo_invalido/);
    expect(await used()).toBe(2);
  });
  it("administrador não gasta vaga", async () => {
    expect((await claim(110, null, false)).founder_number).toBeNull();
    expect(await used()).toBe(2);
  });
  it("para exatamente em 100, mesmo se contas forem apagadas", async () => {
    for (let i = 3; i <= 100; i++) await claim(i);
    expect(await used()).toBe(100);
    expect((await claim(101)).free_until).toBeNull();
    await db.query("delete from auth.users where id = $1", [id(50)]);
    expect((await claim(102)).founder_number).toBeNull();
    expect((await db.query("select 1 from public.memberships where founder_number is not null")).rows).toHaveLength(99);
  });
  it("usuário lê só a própria participação e não altera nada", async () => {
    const as = async (role: string, sql: string) => {
      await db.exec(`set request.jwt.claim.sub = '${id(1)}'; set role ${role};`);
      try { return await db.query(sql); } finally { await db.exec("reset role"); }
    };
    expect((await as("authenticated", "select * from public.memberships")).rows).toHaveLength(1);
    await expect(as("authenticated", "update public.memberships set free_until = now() + interval '9 years'")).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", `select public.claim_membership('${id(1)}', null, true)`)).rejects.toThrow(/permission denied/);
    await expect(as("anon", "select * from public.founder_offer")).rejects.toThrow(/permission denied/);
    await expect(as("anon", `select public.claim_membership('${id(1)}', null, true)`)).rejects.toThrow(/permission denied/);
  });
});
