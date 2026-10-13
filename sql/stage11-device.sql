begin;
create table if not exists public.aleph_device_sessions (
  id uuid primary key, user_id uuid not null, public_jwk jsonb not null,
  token_hash text not null, challenge text, approved boolean not null default false,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.aleph_device_nonces (
  device_id uuid not null references public.aleph_device_sessions(id) on delete cascade,
  nonce uuid not null, created_at timestamptz not null default now(),
  primary key(device_id,nonce)
);
alter table public.aleph_device_sessions enable row level security;
alter table public.aleph_device_nonces enable row level security;
revoke all on public.aleph_device_sessions,public.aleph_device_nonces from public,anon,authenticated;
grant select,insert,update,delete on public.aleph_device_sessions,public.aleph_device_nonces to service_role;
commit;
select not has_table_privilege('anon','public.aleph_device_sessions','SELECT') as anonymous_denied,
 not has_table_privilege('authenticated','public.aleph_device_sessions','UPDATE') as browser_approval_denied,
 has_table_privilege('service_role','public.aleph_device_sessions','UPDATE') as server_confirmation_enabled;
