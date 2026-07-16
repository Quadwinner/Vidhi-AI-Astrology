-- Re-grant admin to shubhamkush0123@gmail.com
alter table if exists public.users add column if not exists is_admin boolean not null default false;

update public.users u
set is_admin = true
from auth.users au
where u.id = au.id
  and lower(au.email) = lower('shubhamkush0123@gmail.com');

insert into public.users (id, is_admin)
select au.id, true from auth.users au
where lower(au.email) = lower('shubhamkush0123@gmail.com')
on conflict (id) do update set is_admin = true;


