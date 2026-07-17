-- service_prices had only a public SELECT policy, so the Admin Price Manager's
-- client-side UPDATE/INSERT was silently blocked by RLS (zero rows changed, no
-- error) — the panel showed "updated" but nothing persisted.
-- Add admin write policies so admins (users.is_admin = true) can manage prices
-- directly from the panel. Reads stay public (frontend uses the anon key).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_prices'
      and policyname = 'admins insert service_prices'
  ) then
    create policy "admins insert service_prices" on public.service_prices
      for insert to authenticated
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_prices'
      and policyname = 'admins update service_prices'
  ) then
    create policy "admins update service_prices" on public.service_prices
      for update to authenticated
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_prices'
      and policyname = 'admins delete service_prices'
  ) then
    create policy "admins delete service_prices" on public.service_prices
      for delete to authenticated
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;
