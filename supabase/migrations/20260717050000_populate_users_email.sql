-- The signup trigger only inserted public.users(id), never the email, so the
-- Admin User Management table showed blank emails for everyone.
-- 1) Ensure the column exists. 2) Backfill from auth.users. 3) Update the
--    trigger so new signups store their email going forward.

alter table public.users add column if not exists email text;

-- Backfill existing rows that are missing an email.
update public.users u
set email = au.email
from auth.users au
where au.id = u.id
  and (u.email is null or u.email = '');

-- Recreate the signup handler to also persist the email (and keep it in sync on
-- conflict). SECURITY DEFINER so it can read the auth.users NEW row.
create or replace function public.handle_new_user_setup()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email)
  values (NEW.id, NEW.email)
  on conflict (id) do update set email = coalesce(excluded.email, public.users.email);
  return NEW;
end;
$$;
