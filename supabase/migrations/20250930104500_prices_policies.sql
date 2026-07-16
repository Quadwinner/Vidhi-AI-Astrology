-- Ensure prices table has admin RLS policies for write
alter table if exists public.prices enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prices' and policyname = 'Admins full access (prices)'
  ) then
    create policy "Admins full access (prices)" on public.prices
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;


