-- init-user-wallet writes users.is_migrated during wallet setup, but the column
-- was never added. The missing column made the upsert throw
-- ("Could not find the 'is_migrated' column"), so currency detection failed and
-- new users fell back to USD. Add the column.
alter table public.users
  add column if not exists is_migrated boolean not null default false;
