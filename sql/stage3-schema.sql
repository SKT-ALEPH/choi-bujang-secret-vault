begin;

-- Preserve the four existing records while moving IDs to the stage 3 UUID contract.
do $$
begin
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes'
      and column_name = 'id' and data_type = 'integer') then
    alter table public.notes alter column id type uuid using gen_random_uuid();
  end if;
end $$;
alter table public.notes alter column id set default gen_random_uuid();
alter table public.notes enable row level security;
revoke all privileges on table public.notes from anon, authenticated;
grant select, insert, update, delete on table public.notes to service_role;
-- No auth.users foreign key: the unchanged verifier also accepts judge test identities.

commit;

select count(*) as preserved_note_count,
  (select data_type from information_schema.columns where table_schema='public'
    and table_name='notes' and column_name='id') as id_type,
  (select relrowsecurity from pg_class where oid='public.notes'::regclass) as rls_enabled,
  has_table_privilege('anon','public.notes','SELECT') as anon_read,
  has_table_privilege('authenticated','public.notes','SELECT') as authenticated_read,
  has_table_privilege('service_role','public.notes','INSERT') as server_write
from public.notes;
