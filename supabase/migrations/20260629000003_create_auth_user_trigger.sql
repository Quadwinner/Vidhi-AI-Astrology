-- The trigger that provisions a public.users row for each new auth user existed
-- only in the old dashboard (triggers on auth.users are often created there and
-- never captured in migrations). Without it, email/Google signups on the new
-- project do NOT get a public.users row, breaking coin balance, wallet, etc.
-- Recreate it to call the existing handle_new_user_setup() function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_setup();
