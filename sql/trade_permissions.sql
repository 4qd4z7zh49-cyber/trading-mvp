create table if not exists public.trade_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  buy_enabled boolean not null default true,
  sell_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.trade_permissions enable row level security;

drop policy if exists "service_role_all_trade_permissions" on public.trade_permissions;
create policy "service_role_all_trade_permissions"
on public.trade_permissions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
