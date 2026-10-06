begin;

create table if not exists public.notes (
  id integer primary key,
  title text not null,
  content text not null,
  owner_id uuid
);

alter table public.notes enable row level security;
revoke all privileges on table public.notes from anon, authenticated;
grant select on table public.notes to service_role;

commit;
