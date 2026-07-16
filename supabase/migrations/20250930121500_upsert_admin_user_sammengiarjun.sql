-- Ensure a public.users row exists for this email and set is_admin = true
insert into public.users (id, is_admin)
select au.id, true
from auth.users au
where lower(au.email) = lower('sammengiarjun@gmail.com')
on conflict (id) do update set is_admin = true;


