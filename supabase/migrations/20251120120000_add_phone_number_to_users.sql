alter table public.users
  add column if not exists phone_number text;

create unique index if not exists users_phone_number_key
  on public.users (phone_number)
  where phone_number is not null;

