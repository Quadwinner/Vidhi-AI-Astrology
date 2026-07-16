-- init-user-wallet writes users.country during wallet setup, but the column
-- was never added to public.users. The missing column made every init-user-wallet
-- upsert throw ("column users.country does not exist"), so currency detection
-- silently failed and new users fell back to USD. Add the column.
alter table public.users
  add column if not exists country text;
