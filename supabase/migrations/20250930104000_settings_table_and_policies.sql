-- Create settings table storing key/value pairs
create table if not exists public.settings (
  id bigserial primary key,
  key text unique not null,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Read for everyone (non-sensitive settings only). Adjust as needed.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'Allow read settings'
  ) then
    create policy "Allow read settings" on public.settings
      for select using (true);
  end if;
end $$;

-- Admins full access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'settings' and policyname = 'Admins full access (settings)'
  ) then
    create policy "Admins full access (settings)" on public.settings
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;


