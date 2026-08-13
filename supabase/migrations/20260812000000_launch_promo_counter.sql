-- Live seat counter for the launch promo landing page (/launch).
--
-- public.users has no created_at column, so signup recency comes from
-- auth.users. That table is not reachable with the anon key, hence a
-- SECURITY DEFINER function that returns ONLY an aggregate integer -- no
-- emails, ids or any other row data can leak through it.
--
-- Capped with least() so the progress bar can never exceed the seat limit.

create or replace function public.get_launch_promo_claimed()
returns integer
language sql
stable
security definer
set search_path = public, auth
as $$
  select least(300, count(*))::integer
  from auth.users
  where created_at >= timestamptz '2026-08-12 00:00:00+00';
$$;

comment on function public.get_launch_promo_claimed() is
  'Returns how many of the 300 launch promo seats are taken. Aggregate only; exposes no user data.';

revoke all on function public.get_launch_promo_claimed() from public;
grant execute on function public.get_launch_promo_claimed() to anon, authenticated;
