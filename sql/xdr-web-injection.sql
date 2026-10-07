-- XDR-02 only. Existing memos, Auth and XDR-01 tables/permissions are untouched.
create table if not exists public.xdr_web_sources (
  source_key text primary key check(source_key ~ '^[a-f0-9]{64}$'),
  window_started timestamptz not null,
  repeat_count integer not null default 0,
  created_at timestamptz, expires_at timestamptz, confidence double precision,
  evidence_ids uuid[] not null default '{}'
);
create table if not exists public.xdr_web_alerts (
  alert_id uuid primary key, at timestamptz not null default now(),
  action text not null check(action in ('block','alert','record')),
  confidence double precision not null check(confidence between 0 and 1),
  reason text not null check(reason in ('sql_injection','script_injection','path_traversal','command_injection','ambiguous_web_input')),
  jev_answered boolean not null default false
);
alter table public.xdr_web_sources enable row level security;
alter table public.xdr_web_alerts enable row level security;
revoke all on public.xdr_web_sources, public.xdr_web_alerts from public,anon,authenticated;
grant select,insert,update on public.xdr_web_sources, public.xdr_web_alerts to service_role;
create or replace function public.xdr_web_observe(p_source_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare row public.xdr_web_sources; t timestamptz:=clock_timestamp();
begin
  if p_source_key is null or p_source_key !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_XDR_INPUT'; end if;
  insert into public.xdr_web_sources(source_key,window_started) values(p_source_key,t) on conflict do nothing;
  select * into row from public.xdr_web_sources where source_key=p_source_key for update;
  if t-row.window_started >= interval '120 seconds' then row.window_started:=t; row.repeat_count:=0; end if;
  row.repeat_count:=least(row.repeat_count+1,100000);
  update public.xdr_web_sources set window_started=row.window_started,repeat_count=row.repeat_count where source_key=p_source_key;
  return jsonb_build_object('at',t,'windowStarted',row.window_started,'repeatCount',row.repeat_count);
end $$;
create or replace function public.xdr_web_apply(p_source_key text,p_window_started timestamptz,
  p_alert_id uuid,p_action text,p_confidence double precision,p_reason text,p_jev_answered boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare t timestamptz:=clock_timestamp();
begin
  if p_source_key is null or p_source_key !~ '^[a-f0-9]{64}$' or p_action is null
    or p_confidence is null or p_confidence not between 0 and 1
    or (p_action='block' and (p_confidence<0.85 or p_reason='ambiguous_web_input')) then raise exception 'INVALID_XDR_INPUT'; end if;
  insert into public.xdr_web_alerts(alert_id,at,action,confidence,reason,jev_answered)
    values(p_alert_id,t,p_action,p_confidence,p_reason,p_jev_answered);
  if p_action='block' then
    update public.xdr_web_sources set created_at=t,expires_at=t+interval '15 minutes',confidence=p_confidence,
      evidence_ids=array_append(evidence_ids,p_alert_id)
      where source_key=p_source_key and window_started=p_window_started and repeat_count>=8;
  end if;
end $$;
revoke all on function public.xdr_web_observe(text) from public,anon,authenticated;
revoke all on function public.xdr_web_apply(text,timestamptz,uuid,text,double precision,text,boolean) from public,anon,authenticated;
grant execute on function public.xdr_web_observe(text) to service_role;
grant execute on function public.xdr_web_apply(text,timestamptz,uuid,text,double precision,text,boolean) to service_role;
