-- PricingContext subscribes to realtime changes on service_prices and
-- wallet_packages to reflect admin price edits live. Those tables were never
-- added to the supabase_realtime publication, so the events never fired and the
-- frontend kept showing the old price until a hard reload (or not at all).
-- Add them to the publication (guarded so re-running is safe).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_prices'
  ) then
    alter publication supabase_realtime add table public.service_prices;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wallet_packages'
  ) then
    alter publication supabase_realtime add table public.wallet_packages;
  end if;
end $$;
