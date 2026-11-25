-- Mês grátis para os 100 primeiros negócios e códigos de indicação.
create table public.founder_offer (
  id boolean primary key default true check (id),
  used integer not null default 0 check (used between 0 and 100)
);
insert into public.founder_offer default values;

create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  founder_number integer unique check (founder_number between 1 and 100),
  free_until timestamptz,
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{6}$'),
  referred_code text check (referred_code <> referral_code),
  created_at timestamptz not null default now(),
  check ((founder_number is null) = (free_until is null))
);
create index memberships_referred_idx on public.memberships (referred_code) where referred_code is not null;

alter table public.founder_offer enable row level security;
alter table public.memberships enable row level security;
create policy "ler minha participação" on public.memberships for select using (user_id = auth.uid() or public.is_admin());
revoke all on public.founder_offer, public.memberships from public, anon, authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.founder_offer, public.memberships to service_role;

-- Entra na rede uma única vez por conta. O update da vaga trava a linha: nunca há a 101ª.
create or replace function public.claim_membership(p_user uuid, p_code text, p_founder boolean) returns public.memberships
language plpgsql security definer set search_path = public as $$
declare
  m public.memberships;
  n integer;
  c text := nullif(upper(btrim(coalesce(p_code, ''))), '');
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into m from public.memberships where user_id = p_user;
  if found then return m; end if;
  if c is not null and not exists (select 1 from public.memberships where referral_code = c) then
    raise exception 'codigo_invalido';
  end if;
  if p_founder then
    update public.founder_offer set used = used + 1 where used < 100 returning used into n;
  end if;
  loop
    insert into public.memberships (user_id, founder_number, free_until, referral_code, referred_code)
    values (p_user, n, case when n is not null then now() + interval '1 month' end,
            upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), c)
    on conflict (referral_code) do nothing
    returning * into m;
    exit when found;
  end loop;
  return m;
end $$;
revoke all on function public.claim_membership(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_membership(uuid, text, boolean) to service_role;
