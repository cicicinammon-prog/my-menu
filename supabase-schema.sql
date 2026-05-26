create table if not exists public.dishes (
  id text primary key,
  name text not null,
  category text not null check (category in ('主食', '汤羹', '特色菜')),
  description text default '',
  image text default '',
  sort_index integer default 0,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id text primary key,
  pickup_code text not null,
  created_at timestamptz not null default now(),
  created_label text not null,
  total_count integer not null default 0,
  items jsonb not null default '[]'::jsonb
);

alter table public.dishes enable row level security;
alter table public.orders enable row level security;

drop policy if exists "family dishes readable" on public.dishes;
drop policy if exists "family dishes writable" on public.dishes;
drop policy if exists "family orders readable" on public.orders;
drop policy if exists "family orders writable" on public.orders;

create policy "family dishes readable" on public.dishes for select using (true);
create policy "family dishes writable" on public.dishes for all using (true) with check (true);
create policy "family orders readable" on public.orders for select using (true);
create policy "family orders writable" on public.orders for insert with check (true);

alter publication supabase_realtime add table public.dishes;
alter publication supabase_realtime add table public.orders;
