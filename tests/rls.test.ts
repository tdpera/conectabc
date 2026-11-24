/**
 * Executa as migrações reais em um Postgres (PGlite, WASM) e verifica o RLS:
 * cada usuário só lê o que é seu, e escrita direta em mensagens/parcerias é bloqueada.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const BA = "10000000-0000-0000-0000-00000000000a";
const BB = "10000000-0000-0000-0000-00000000000b";

// Stub mínimo do esquema `auth` do Supabase
const AUTH_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text) $$;
grant usage on schema public, auth to anon, authenticated, service_role;
`;

let db: PGlite;

async function as(user: string | null, sql: string) {
  await db.exec("reset role");
  if (user) {
    await db.exec(`set request.jwt.claim.sub = '${user}'; set request.jwt.claim.role = 'authenticated'; set role authenticated;`);
  } else await db.exec(`set request.jwt.claim.sub = ''; set role anon;`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of ["0001_schema.sql", "0002_rls.sql", "0003_functions.sql"]) {
    const sql = readFileSync(path.join(__dirname, "../supabase/migrations", f), "utf8").replace(/create extension[^;]+;/i, "");
    await db.exec(sql);
  }
  await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
  await db.exec(`
    insert into auth.users (id, email) values ('${A}', 'a@teste.com'), ('${B}', 'b@teste.com');
    insert into public.businesses (id, owner_id, name, category, city, phone) values
      ('${BA}', '${A}', 'Negócio A', 'cafes', 'Balneário Camboriú', '(47) 1111-1111'),
      ('${BB}', '${B}', 'Negócio B', 'bares', 'Balneário Camboriú', '(47) 2222-2222');
    insert into public.messages (sender_id, recipient_id, sender_business_id, recipient_business_id, body)
      values ('${B}', '${A}', '${BB}', '${BA}', 'Oi A');
    insert into public.subscriptions (user_id, status, amount, currency) values ('${B}', 'active', 4999, 'brl');
  `);
}, 60000);

describe("RLS no banco", () => {
  it("cria perfis automaticamente no cadastro", async () => {
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.profiles");
    expect(r.rows[0].n).toBe(2);
  });
  it("usuário só lê o próprio negócio (contatos alheios protegidos)", async () => {
    const r = await as(A, "select id, phone from public.businesses");
    expect(r.rows).toEqual([{ id: BA, phone: "(47) 1111-1111" }]);
  });
  it("visitante anônimo não lê nada direto do banco", async () => {
    expect((await as(null, "select * from public.businesses")).rows).toHaveLength(0);
    expect((await as(null, "select * from public.messages")).rows).toHaveLength(0);
  });
  it("lê mensagens das quais participa, e só elas", async () => {
    expect((await as(A, "select * from public.messages")).rows).toHaveLength(1);
    await db.exec(`insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@t.com')`);
    expect((await as("00000000-0000-0000-0000-00000000000c", "select * from public.messages")).rows).toHaveLength(0);
  });
  it("bloqueia escrita direta em mensagens e parcerias", async () => {
    await expect(as(A, `insert into public.messages (sender_id, recipient_id, sender_business_id, recipient_business_id, body) values ('${A}','${B}','${BA}','${BB}','x')`)).rejects.toThrow(/row-level security/);
    await expect(as(A, `insert into public.partnerships (requester_id, recipient_id, requester_business_id, recipient_business_id, type, intro) values ('${A}','${B}','${BA}','${BB}','outro','apresentação longa')`)).rejects.toThrow(/row-level security/);
  });
  it("não permite forjar assinatura nem ler a de outros", async () => {
    expect((await as(A, "select * from public.subscriptions")).rows).toHaveLength(0);
    await expect(as(A, `insert into public.subscriptions (user_id, status) values ('${A}', 'active')`)).rejects.toThrow(/row-level security/);
  });
  it("não permite criar negócio em nome de outro, nem trocar o dono", async () => {
    await expect(as(A, `insert into public.businesses (owner_id, name, category, city) values ('${B}', 'Fake', 'cafes', 'BC')`)).rejects.toThrow();
    await as(A, `update public.businesses set owner_id = '${B}', is_visible = false where id = '${BA}'`);
    const r = await db.query<{ owner_id: string; is_visible: boolean }>(`select owner_id, is_visible from public.businesses where id = '${BA}'`);
    expect(r.rows[0]).toEqual({ owner_id: A, is_visible: true });
  });
  it("impede duas parcerias vivas no mesmo par, em qualquer direção", async () => {
    await db.exec(`insert into public.partnerships (requester_id, recipient_id, requester_business_id, recipient_business_id, type, intro) values ('${A}','${B}','${BA}','${BB}','outro','apresentação longa')`);
    await expect(db.exec(`insert into public.partnerships (requester_id, recipient_id, requester_business_id, recipient_business_id, type, intro) values ('${B}','${A}','${BB}','${BA}','evento','outra apresentação')`)).rejects.toThrow(/duplicate key/);
  });
  it("um negócio por conta", async () => {
    await expect(db.exec(`insert into public.businesses (owner_id, name, category, city) values ('${A}', 'Segundo', 'cafes', 'BC')`)).rejects.toThrow(/duplicate key/);
  });
});
