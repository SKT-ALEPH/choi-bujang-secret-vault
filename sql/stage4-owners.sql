-- Replace these placeholders directly in SQL Editor with two confirmed test accounts.
-- Do not commit real emails. This script never creates users or passwords.
begin;
do $$
declare
  a_email text := 'A_TEST_EMAIL';
  b_email text := 'B_TEST_EMAIL';
  a_id uuid;
  b_id uuid;
  seed_ids uuid[];
begin
  select id into a_id from auth.users where email=a_email;
  select id into b_id from auth.users where email=b_email;
  if a_id is null or b_id is null or a_id=b_id then
    raise exception 'Two different existing test accounts are required; no notes changed';
  end if;
  select array_agg(id order by id) into seed_ids from public.notes where owner_id is null;
  if coalesce(array_length(seed_ids,1),0) <> 4 then
    raise exception 'Expected four unassigned practice notes; no notes changed';
  end if;
  update public.notes set owner_id=a_id where id=any(seed_ids[1:3]);
  update public.notes set owner_id=b_id where id=seed_ids[4];
end $$;
commit;
