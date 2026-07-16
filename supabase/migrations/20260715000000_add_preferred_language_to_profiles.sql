-- user_profiles.preferred_language was added in the old dashboard but never
-- captured as a migration. get-chat-answer queries it.
alter table public.user_profiles
  add column if not exists preferred_language text default 'en';
