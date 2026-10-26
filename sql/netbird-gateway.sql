-- Additional proof replay protection only; existing notes, accounts and policies are preserved.
create table if not exists public.netbird_gateway_nonces (
  nonce uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.netbird_gateway_nonces enable row level security;
revoke all on public.netbird_gateway_nonces from public, anon, authenticated;
grant select, insert on public.netbird_gateway_nonces to service_role;
