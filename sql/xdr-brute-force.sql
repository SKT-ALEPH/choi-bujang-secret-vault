-- Private server-side XDR state. Never store passwords, tokens, raw IPs or emails.
create table if not exists public.xdr_sources (
  source_key text primary key check (source_key ~ '^[a-f0-9]{64}$'),
  window_started timestamptz not null,
  failure_count integer not null default 0,
  accounts text[] not null default '{}',
  created_at timestamptz,
  expires_at timestamptz,
  confidence double precision,
  evidence_ids uuid[] not null default '{}'
);
create table if not exists public.xdr_alerts (
  alert_id uuid primary key,
  at timestamptz not null default now(),
  action text not null check (action in ('block','alert','record')),
  confidence double precision not null check (confidence between 0 and 1),
  reason text not null check (reason in ('normal_activity','repeated_password_guessing','ambiguous_authentication_failures'))
);
alter table public.xdr_sources enable row level security;
alter table public.xdr_alerts enable row level security;
revoke all on public.xdr_sources, public.xdr_alerts from public, anon, authenticated;
grant select, insert, update on public.xdr_sources, public.xdr_alerts to service_role;

create or replace function public.xdr_failure(p_source_key text, p_account_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare row public.xdr_sources; t timestamptz := clock_timestamp();
begin
  if p_source_key !~ '^[a-f0-9]{64}$' or p_account_key !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_XDR_INPUT';
  end if;
  insert into public.xdr_sources(source_key,window_started,failure_count,accounts)
    values(p_source_key,t,0,'{}') on conflict do nothing;
  select * into row from public.xdr_sources where source_key=p_source_key for update;
  if t-row.window_started >= interval '120 seconds' then
    row.window_started := t; row.failure_count := 0; row.accounts := '{}';
  end if;
  row.failure_count := least(row.failure_count+1,100000);
  if not p_account_key=any(row.accounts) and cardinality(row.accounts)<128 then
    row.accounts := array_append(row.accounts,p_account_key);
  end if;
  update public.xdr_sources set window_started=row.window_started,
    failure_count=row.failure_count,accounts=row.accounts where source_key=p_source_key;
  return jsonb_build_object('at',t,'windowStarted',row.window_started,
    'failureCount',row.failure_count,'accountCount',cardinality(row.accounts));
end $$;

create or replace function public.xdr_apply(p_source_key text,p_window_started timestamptz,
  p_alert_id uuid,p_action text,p_confidence double precision,p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
declare t timestamptz := clock_timestamp();
begin
  if p_source_key !~ '^[a-f0-9]{64}$' or p_confidence not between 0 and 1
    or (p_action='block' and p_confidence<0.85) then raise exception 'INVALID_XDR_INPUT'; end if;
  insert into public.xdr_alerts(alert_id,at,action,confidence,reason)
    values(p_alert_id,t,p_action,p_confidence,p_reason);
  if p_action='block' then
    update public.xdr_sources set created_at=t,expires_at=t+interval '15 minutes',
      confidence=p_confidence,evidence_ids=array_append(evidence_ids,p_alert_id)
      where source_key=p_source_key and window_started=p_window_started;
  end if;
end $$;
revoke all on function public.xdr_failure(text,text) from public,anon,authenticated;
revoke all on function public.xdr_apply(text,timestamptz,uuid,text,double precision,text) from public,anon,authenticated;
grant execute on function public.xdr_failure(text,text) to service_role;
grant execute on function public.xdr_apply(text,timestamptz,uuid,text,double precision,text) to service_role;
