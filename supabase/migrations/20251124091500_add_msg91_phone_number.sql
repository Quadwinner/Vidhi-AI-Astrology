alter table public.users
  add column if not exists msg91_phone_number text;

create unique index if not exists users_msg91_phone_number_key
  on public.users (msg91_phone_number)
  where msg91_phone_number is not null;
