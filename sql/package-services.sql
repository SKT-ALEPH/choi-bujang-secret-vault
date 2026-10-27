-- P3-P5: service-only quota and public-source cache. Existing data is untouched.
begin;
create table if not exists public.package_ai_usage (
  subject_id uuid not null,
  usage_day date not null,
  calls integer not null check (calls >= 0),
  primary key (subject_id, usage_day)
);
create table if not exists public.package_threat_cache (
  cache_key text primary key check (length(cache_key) between 1 and 160),
  payload jsonb not null,
  fetched_at timestamptz not null default clock_timestamp()
);
alter table public.package_ai_usage enable row level security;
alter table public.package_threat_cache enable row level security;
revoke all on public.package_ai_usage, public.package_threat_cache from public, anon, authenticated;
grant select, insert, update on public.package_ai_usage, public.package_threat_cache to service_role;

create or replace function public.package_reserve_ai_call(p_user uuid, p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  today date := (clock_timestamp() at time zone 'UTC')::date;
  used integer;
  accepted boolean;
begin
  if p_user is null or p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'INVALID_QUOTA_ARGUMENT';
  end if;
  insert into public.package_ai_usage(subject_id, usage_day, calls)
    values (p_user, today, 1)
    on conflict (subject_id, usage_day) do update
      set calls = package_ai_usage.calls + 1
      where package_ai_usage.calls < p_limit
    returning calls into used;
  accepted := found;
  if not accepted then
    select calls into used from public.package_ai_usage
      where subject_id = p_user and usage_day = today;
  end if;
  return jsonb_build_object('allowed', accepted, 'used', used, 'limit', p_limit,
    'remaining', greatest(0, p_limit-used), 'resetsAt', ((today+1)::timestamp at time zone 'UTC'));
end;
$$;
revoke all on function public.package_reserve_ai_call(uuid, integer) from public, anon, authenticated;
grant execute on function public.package_reserve_ai_call(uuid, integer) to service_role;
commit;
