-- ConectaBC: esquema principal
create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create type public.business_category as enum
  ('restaurantes','cafes','bares','varejo','beleza','turismo','hoteis','esporte','servicos','outros');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade, -- 1 negócio por conta
  name text not null check (char_length(name) between 2 and 120),
  category public.business_category not null,
  description text not null default '' check (char_length(description) <= 1500),
  neighborhood text not null default '',
  city text not null check (char_length(city) >= 2),
  address text not null default '',
  state text not null default '' check (char_length(state) <= 2),
  hours text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  instagram text not null default '',
  website text not null default '',
  cover_url text check (cover_url is null or cover_url like 'https://%'),
  ideal_partners text not null default '' check (char_length(ideal_partners) <= 600),
  partner_offer text not null default '' check (char_length(partner_offer) <= 600),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pin_both_or_none check ((lat is null) = (lng is null))
);
create index businesses_created_idx on public.businesses (created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_business_id uuid not null references public.businesses(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_business_id <> recipient_business_id)
);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_recipient_idx on public.messages (recipient_id, created_at desc);

create type public.partnership_type as enum ('indicacao','desconto','promocao','evento','outro');
create type public.partnership_status as enum ('pending','accepted','declined','cancelled');

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  requester_business_id uuid not null references public.businesses(id) on delete cascade,
  recipient_business_id uuid not null references public.businesses(id) on delete cascade,
  type public.partnership_type not null,
  intro text not null check (char_length(btrim(intro)) between 10 and 1500),
  status public.partnership_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_business_id <> recipient_business_id)
);
-- Só uma proposta pendente ou aceita por par de negócios (em qualquer direção).
create unique index partnerships_one_live_per_pair on public.partnerships (
  least(requester_business_id, recipient_business_id),
  greatest(requester_business_id, recipient_business_id)
) where status in ('pending','accepted');

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  interval text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  trial_end timestamptz,
  amount integer,
  currency text,
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  stripe_event_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
