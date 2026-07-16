-- Add email column to public.users for admin UI convenience
alter table if exists public.users add column if not exists email text;

-- Backfill from auth.users
update public.users u
set email = au.email
from auth.users au
where u.id = au.id and (u.email is null or u.email = '');

-- Optional index to speed up lookups by email
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_users_email'
  ) then
    create index idx_users_email on public.users using btree (lower(email));
  end if;
end $$;


