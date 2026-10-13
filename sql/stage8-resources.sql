begin;
-- Separate resources; existing notes, Auth, permissions and XDR remain untouched.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(title) between 1 and 200),
  content text not null check(length(content) <= 10000)
);
create table if not exists public.announcement_editors (
  user_id uuid not null,
  announcement_id uuid not null references public.announcements(id),
  primary key(user_id, announcement_id)
);
alter table public.announcements enable row level security;
alter table public.announcement_editors enable row level security;
revoke all on public.announcements, public.announcement_editors from public, anon, authenticated;
grant select on public.announcements, public.announcement_editors to service_role;
grant update(title, content) on public.announcements to service_role;

create or replace function public.edit_announcement(p_user uuid, p_id uuid, p_title text, p_content text)
returns table(id uuid, title text, content text)
language sql security invoker set search_path='' as $$
  update public.announcements as a set title=p_title, content=p_content
  where a.id=p_id and exists (
    select 1 from public.announcement_editors as g
    where g.user_id=p_user and g.announcement_id=a.id
  ) returning a.id, a.title, a.content;
$$;
revoke all on function public.edit_announcement(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.edit_announcement(uuid,uuid,text,text) to service_role;
-- Grant rows are managed by the database owner, never by a browser or app endpoint.
commit;
