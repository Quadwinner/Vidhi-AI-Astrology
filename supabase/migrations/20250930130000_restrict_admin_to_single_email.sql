-- Restrict admin to only the specified email
alter table if exists public.users add column if not exists is_admin boolean not null default false;

-- Ensure target email is admin
update public.users u
set is_admin = true
from auth.users au
where u.id = au.id
  and lower(au.email) = lower('shubhamkush012@gmail.com');

-- Revoke admin for all other accounts
update public.users u
set is_admin = false
from auth.users au
where u.id = au.id
  and lower(au.email) <> lower('shubhamkush012@gmail.com');


