begin;
create schema if not exists aleph_recovery;
revoke all on schema aleph_recovery from public, anon, authenticated, service_role;

create table if not exists aleph_recovery.note_backups (
  note_id uuid primary key, owner_id uuid not null, title text not null, content text not null,
  content_sha256 text not null, policy_sha256 text not null, seal_sha256 text not null,
  backup_version integer not null default 1, captured_at timestamptz not null default now()
);
create table if not exists aleph_recovery.restore_audit (
  id bigint generated always as identity primary key, note_id uuid not null, actor_id uuid not null,
  policy_sha256 text not null, restored_at timestamptz not null default now()
);
alter table aleph_recovery.note_backups enable row level security;
alter table aleph_recovery.restore_audit enable row level security;
revoke all on all tables in schema aleph_recovery from public, anon, authenticated, service_role;
revoke all on all sequences in schema aleph_recovery from public, anon, authenticated, service_role;

create or replace function aleph_recovery.note_seal(p_id uuid,p_owner uuid,p_title text,p_content text,p_policy text)
returns text language sql immutable strict set search_path = '' as $$
  select encode(extensions.digest(jsonb_build_array(p_id::text,p_owner::text,p_title,p_content,p_policy)::text,'sha256'),'hex');
$$;
revoke all on function aleph_recovery.note_seal(uuid,uuid,text,text,text) from public, anon, authenticated, service_role;

create or replace function aleph_recovery.capture_note() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is not null then
    if exists(select 1 from aleph_recovery.note_backups b where b.note_id=new.id and b.owner_id<>new.owner_id) then
      raise exception 'NOTE_ID_EXISTS' using errcode='23505';
    end if;
    insert into aleph_recovery.note_backups(note_id,owner_id,title,content,content_sha256,policy_sha256,seal_sha256)
    values(new.id,new.owner_id,new.title,new.content,encode(extensions.digest(new.content,'sha256'),'hex'),
      'e8c09bfe89540f72a82c02d8e7202d670bb782f9311017a639cd1e4eb470c99c',aleph_recovery.note_seal(new.id,new.owner_id,new.title,new.content,'e8c09bfe89540f72a82c02d8e7202d670bb782f9311017a639cd1e4eb470c99c'))
    on conflict(note_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function aleph_recovery.capture_note() from public, anon, authenticated, service_role;
create or replace trigger aleph_capture_note_backup after insert on public.notes
for each row execute function aleph_recovery.capture_note();

-- Capture the current owned notes once; ownerless legacy rows and live data are unchanged.
insert into aleph_recovery.note_backups(note_id,owner_id,title,content,content_sha256,policy_sha256,seal_sha256)
select n.id,n.owner_id,n.title,n.content,encode(extensions.digest(n.content,'sha256'),'hex'),
  'e8c09bfe89540f72a82c02d8e7202d670bb782f9311017a639cd1e4eb470c99c',aleph_recovery.note_seal(n.id,n.owner_id,n.title,n.content,'e8c09bfe89540f72a82c02d8e7202d670bb782f9311017a639cd1e4eb470c99c')
from public.notes n where n.owner_id is not null on conflict(note_id) do nothing;

create or replace function public.restore_aleph_note(p_actor uuid,p_note uuid,p_policy_hash text)
returns table(note_id uuid,owner_id uuid,content_sha256 text,policy_sha256 text,backup_version integer,verified boolean,audit_id bigint)
language plpgsql security definer set search_path = '' as $$
declare
  saved aleph_recovery.note_backups%rowtype;
  restored public.notes%rowtype;
  event_id bigint;
begin
  select b.* into saved from aleph_recovery.note_backups b
    where b.note_id=p_note and b.owner_id=p_actor for share;
  if not found then return; end if;
  if saved.backup_version <> 1 or saved.policy_sha256 is distinct from p_policy_hash
      or saved.content_sha256 <> encode(extensions.digest(saved.content,'sha256'),'hex')
      or saved.seal_sha256 <> aleph_recovery.note_seal(saved.note_id,saved.owner_id,saved.title,saved.content,saved.policy_sha256)
  then raise exception 'BACKUP_VERIFICATION_FAILED'; end if;

  insert into public.notes as n(id,owner_id,title,content)
  values(saved.note_id,saved.owner_id,saved.title,saved.content)
  on conflict(id) do update set title=excluded.title,content=excluded.content
    where n.owner_id=p_actor
  returning n.* into restored;
  if not found then raise exception 'BACKUP_OWNER_CONFLICT'; end if;
  if restored.id <> saved.note_id or restored.owner_id <> saved.owner_id or restored.title <> saved.title
      or encode(extensions.digest(restored.content,'sha256'),'hex') <> saved.content_sha256
  then raise exception 'RESTORE_VERIFICATION_FAILED'; end if;

  insert into aleph_recovery.restore_audit as a(note_id,actor_id,policy_sha256)
    values(saved.note_id,p_actor,saved.policy_sha256) returning a.id into event_id;
  return query select restored.id,restored.owner_id,saved.content_sha256,saved.policy_sha256,saved.backup_version,true,event_id;
end;
$$;
revoke all on function public.restore_aleph_note(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.restore_aleph_note(uuid,uuid,text) to service_role;
commit;

select
  not has_schema_privilege('anon','aleph_recovery','USAGE') as backup_anon_denied,
  not has_schema_privilege('authenticated','aleph_recovery','USAGE') as backup_authenticated_denied,
  not has_function_privilege('anon','public.restore_aleph_note(uuid,uuid,text)','EXECUTE') as rpc_anon_denied,
  not has_function_privilege('authenticated','public.restore_aleph_note(uuid,uuid,text)','EXECUTE') as rpc_authenticated_denied,
  has_function_privilege('service_role','public.restore_aleph_note(uuid,uuid,text)','EXECUTE') as server_restore_enabled,
  not has_table_privilege('anon','public.notes','SELECT') as notes_anon_still_denied,
  not has_table_privilege('authenticated','public.notes','SELECT') as notes_authenticated_still_denied;
