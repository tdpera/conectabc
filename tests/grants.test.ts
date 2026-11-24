/** Reproduz um projeto Supabase novo (sem grants automáticos) e confere a migração 0004. */
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth to anon, authenticated, service_role;
`;
let db: PGlite;
async function as(role: string, sql: string, user = "") {
  await db.exec(`set request.jwt.claim.sub = '${user}'; set role ${role};`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of ["0001_schema", "0002_rls", "0003_functions", "0004_grants"]) {
    const sql = readFileSync(path.join(__dirname, `../supabase/migrations/${f}.sql`), "utf8");
    await db.exec(sql.replace(/create extension[^;]+;/i, ""));
  }
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@teste.com'), ('${B}', 'b@teste.com')`);
}, 60000);

describe("permissões em projeto novo", () => {
  it("o servidor escreve e lê", async () => {
    await as("service_role", `insert into public.businesses (owner_id, name, category, city) values ('${A}', 'Negócio A', 'cafes', 'BC'), ('${B}', 'Negócio B', 'bares', 'BC')`);
    expect((await as("service_role", "select * from public.businesses")).rows).toHaveLength(2);
    expect((await as("service_role", "select * from public.billing_events")).rows).toHaveLength(0);
  });
  it("o usuário lê só o próprio negócio e não escreve direto", async () => {
    expect((await as("authenticated", "select * from public.businesses", A)).rows).toHaveLength(1);
    await expect(as("authenticated", `update public.businesses set name = 'Hack' where owner_id = '${A}'`, A)).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", `update public.profiles set is_admin = true where id = '${A}'`, A)).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", "select * from public.billing_events", A)).rejects.toThrow(/permission denied/);
  });
  it("o visitante anônimo não acessa nada", async () => {
    await expect(as("anon", "select * from public.businesses")).rejects.toThrow(/permission denied/);
  });
});
