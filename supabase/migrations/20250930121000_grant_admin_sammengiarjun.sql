-- Grant admin to specified email
alter table if exists public.users add column if not exists is_admin boolean not null default false;

update public.users u
set is_admin = true
from auth.users au
where u.id = au.id
  and lower(au.email) = lower('sammengiarjun@gmail.com');


