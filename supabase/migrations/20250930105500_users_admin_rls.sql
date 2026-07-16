-- Ensure users table allows admins to read/update
alter table if exists public.users enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'users' and policyname = 'Admins full access (users)'
  ) then
    create policy "Admins full access (users)" on public.users
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;


