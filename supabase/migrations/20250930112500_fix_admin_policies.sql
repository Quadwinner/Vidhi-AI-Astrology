-- Create helper function to check admin without triggering RLS recursion
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.users where id = p_uid), false);
$$;

comment on function public.is_admin(uuid) is 'Returns true if the given user id has admin privileges.';

-- Update policies on users to use the helper function
drop policy if exists "Admins full access (users)" on public.users;
create policy "Admins full access (users)" on public.users
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Update blogs policies
drop policy if exists "Admins full access" on public.blogs;
create policy "Admins full access" on public.blogs
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Update settings policies
drop policy if exists "Admins full access (settings)" on public.settings;
create policy "Admins full access (settings)" on public.settings
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Update prices policies
drop policy if exists "Admins full access (prices)" on public.prices;
create policy "Admins full access (prices)" on public.prices
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));


