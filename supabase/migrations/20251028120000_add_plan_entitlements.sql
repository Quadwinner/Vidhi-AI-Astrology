-- Add plan_entitlements table to configure subscription benefits per plan
-- Safe, additive migration. No data resets.

create table if not exists public.plan_entitlements (
  plan_id text primary key references public.subscription_plans(id) on delete cascade,
  questions_per_month integer not null default 0,
  daily_horoscope_enabled boolean not null default false,
  divisional_charts_enabled boolean not null default false,
  ai_call_talk_minutes integer not null default 0,
  weekly_forecasts_enabled boolean not null default false,
  max_profiles integer not null default 1,
  max_saved_threads integer not null default 3,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

-- Enable RLS and restrict writes to admins
alter table if exists public.plan_entitlements enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'plan_entitlements' and policyname = 'Admins full access (plan_entitlements)'
  ) then
    create policy "Admins full access (plan_entitlements)" on public.plan_entitlements
      for all
      using (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true))
      with check (exists (select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true));
  end if;
end $$;

-- Public read policy (safe to expose entitlements to clients)
do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'plan_entitlements' and policyname = 'Public read (plan_entitlements)'
  ) then
    create policy "Public read (plan_entitlements)" on public.plan_entitlements
      for select using (true);
  end if;
end $$;



