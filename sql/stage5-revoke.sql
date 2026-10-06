-- Only the learning notes table changes; preserve rows and owner RLS policies.
select role_name, privilege, has_table_privilege(role_name,'public.notes',privilege) as allowed
from (values ('anon'),('authenticated'),('service_role')) as roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) as privileges(privilege)
order by role_name, privilege;

begin;
revoke all privileges on table public.notes from PUBLIC, anon, authenticated;
commit;

select role_name, privilege, has_table_privilege(role_name,'public.notes',privilege) as allowed
from (values ('anon'),('authenticated'),('service_role')) as roles(role_name)
cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) as privileges(privilege)
order by role_name, privilege;
