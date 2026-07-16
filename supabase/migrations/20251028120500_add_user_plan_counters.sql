-- Track per-user monthly usage for plan entitlements (questions and talk minutes)

create table if not exists public.user_plan_counters (
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  questions_used integer not null default 0,
  talk_minutes_used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, cycle_start)
);

-- Helper index for current cycle lookups
create index if not exists idx_user_plan_counters_current 
  on public.user_plan_counters(user_id, cycle_end);

alter table if exists public.user_plan_counters enable row level security;

-- Users can read their own counters; admins full access
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_plan_counters' and policyname='Users read own counters'
  ) then
    create policy "Users read own counters" on public.user_plan_counters
      for select using (auth.uid() = user_id or exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin,false)));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_plan_counters' and policyname='Admins full access (user_plan_counters)'
  ) then
    create policy "Admins full access (user_plan_counters)" on public.user_plan_counters
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin,false)))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin,false)));
  end if;
end $$;



