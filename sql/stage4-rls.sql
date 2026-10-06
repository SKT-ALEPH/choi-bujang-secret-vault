-- Compare both listed grants and effective grants before changing only notes.
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='notes' and grantee in ('PUBLIC','anon','authenticated')
order by grantee, privilege_type;
select role_name, privilege, has_table_privilege(role_name,'public.notes',privilege) as allowed
from (values ('anon'),('authenticated')) as roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) as privileges(privilege);

begin;
alter table public.notes enable row level security;
revoke all privileges on table public.notes from PUBLIC, anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

drop policy if exists notes_owner_select on public.notes;
drop policy if exists notes_owner_insert on public.notes;
drop policy if exists notes_owner_update on public.notes;
drop policy if exists notes_owner_delete on public.notes;
create policy notes_owner_select on public.notes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy notes_owner_insert on public.notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy notes_owner_update on public.notes for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy notes_owner_delete on public.notes for delete to authenticated
  using ((select auth.uid()) = owner_id);
commit;

select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='notes' and grantee in ('PUBLIC','anon','authenticated')
order by grantee, privilege_type;
select role_name, privilege, has_table_privilege(role_name,'public.notes',privilege) as allowed
from (values ('anon'),('authenticated')) as roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) as privileges(privilege);
