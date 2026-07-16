-- Create a helper function for the dashboard to get current cycle counters
-- This ensures the dashboard uses the EXACT same cycle logic as the counter increments

create or replace function public.get_current_cycle_counters(p_user_id uuid)
returns table (
  questions_used integer,
  talk_minutes_used integer,
  cycle_start date,
  cycle_end date,
  questions_remaining integer,
  talk_minutes_remaining integer,
  plan_tier text,
  questions_per_month integer,
  ai_call_talk_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_sub_start date;
  v_now date := current_date;
  v_cycle_start date;
  v_cycle_end date;
  v_anchor date;
  v_counters record;
  v_entitlement record;
begin
  -- Fetch user plan info
  select u.plan_tier, u.subscription_start_date
  into v_plan, v_sub_start
  from public.users u
  where u.id = p_user_id;

  if v_plan is null then
    v_plan := 'free';
  end if;

  -- Compute cycle boundaries (SAME logic as upsert_increment_counter_normalized)
  if lower(coalesce(v_plan,'')) = 'yearly' then
    v_anchor := coalesce(
      v_sub_start,
      make_date(extract(year from v_now)::int, 1, 1)
    );
    v_cycle_start := make_date(
      extract(year from v_now)::int,
      extract(month from v_anchor)::int,
      least(extract(day from v_anchor)::int, 28)
    );
    if v_now < v_cycle_start then
      v_cycle_start := (v_cycle_start - interval '1 year')::date;
    end if;
    v_cycle_end := (v_cycle_start + interval '1 year')::date;
  else
    -- Monthly or free: use calendar month
    v_cycle_start := date_trunc('month', v_now)::date;
    v_cycle_end := (date_trunc('month', v_now) + interval '1 month')::date;
  end if;

  -- Fetch current counters
  select c.questions_used, c.talk_minutes_used
  into v_counters
  from public.user_plan_counters c
  where c.user_id = p_user_id
    and c.cycle_start = v_cycle_start
    and c.cycle_end = v_cycle_end;

  -- Fetch entitlements
  select e.questions_per_month, e.ai_call_talk_minutes
  into v_entitlement
  from public.plan_entitlements e
  where e.plan_id = v_plan;

  -- Return computed values
  return query select
    coalesce(v_counters.questions_used, 0)::integer,
    coalesce(v_counters.talk_minutes_used, 0)::integer,
    v_cycle_start,
    v_cycle_end,
    greatest(0, coalesce(v_entitlement.questions_per_month, 0) - coalesce(v_counters.questions_used, 0))::integer,
    greatest(0, coalesce(v_entitlement.ai_call_talk_minutes, 0) - coalesce(v_counters.talk_minutes_used, 0))::integer,
    v_plan,
    coalesce(v_entitlement.questions_per_month, 0)::integer,
    coalesce(v_entitlement.ai_call_talk_minutes, 0)::integer;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.get_current_cycle_counters to authenticated, anon;

-- Add comment for documentation
comment on function public.get_current_cycle_counters is
  'Returns current cycle usage counters and remaining allowances for a user. Uses the same cycle boundary logic as the counter increment functions to ensure consistency.';

