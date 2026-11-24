-- Permissões explícitas: projetos novos do Supabase não expõem tabelas à API automaticamente.
-- O servidor (service role) faz todas as escritas; o cliente só lê o que o RLS permite.
grant usage on schema public to anon, authenticated, service_role;
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.businesses, public.messages, public.partnerships, public.subscriptions to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- Sem escrita direta: senão daria para pular a validação do servidor (lib/rules.ts).
drop policy if exists "criar o próprio negócio" on public.businesses;
drop policy if exists "editar o próprio negócio" on public.businesses;
