-- Controle de acesso no banco: cada usuário só lê o que é seu.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.messages enable row level security;
alter table public.partnerships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- profiles
create policy "perfil próprio" on public.profiles for select using (id = auth.uid() or public.is_admin());

-- businesses: o diretório é servido pelo servidor (service role), não pelo banco aberto.
create policy "ler o próprio negócio" on public.businesses for select using (owner_id = auth.uid() or public.is_admin());
create policy "criar o próprio negócio" on public.businesses for insert with check (owner_id = auth.uid());
create policy "editar o próprio negócio" on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- messages: só leitura das próprias; nenhuma escrita direta.
create policy "ler minhas mensagens" on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

-- partnerships: só leitura das próprias; nenhuma escrita direta.
create policy "ler minhas parcerias" on public.partnerships for select
  using (requester_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

-- subscriptions: só leitura da própria; escrita apenas via webhook (service role).
create policy "ler minha assinatura" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());

-- billing_events: sem políticas = inacessível para clientes.

-- Impede que o dono mude a própria visibilidade/dono pelo cliente.
create or replace function public.protect_business_columns() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.owner_id := old.owner_id;
    new.is_visible := old.is_visible;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger businesses_protect before update on public.businesses
  for each row execute function public.protect_business_columns();
