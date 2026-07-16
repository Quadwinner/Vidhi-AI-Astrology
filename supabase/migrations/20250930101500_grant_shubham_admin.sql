-- Ensure is_admin exists on public.users
alter table if exists public.users add column if not exists is_admin boolean not null default false;

-- Grant admin to the specified email by mapping via auth.users
update public.users u
set is_admin = true
from auth.users au
where u.id = au.id
  and lower(au.email) = lower('shubhamkush012@gmail.com');


