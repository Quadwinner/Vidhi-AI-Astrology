-- Normalized helper to compute cycle boundaries and upsert counters server-side

create or replace function public.upsert_increment_counter_normalized(
  p_user_id uuid,
  p_plan_tier text,
  p_subscription_start_date date,
  p_kind text,              -- 'questions' | 'minutes'
  p_inc integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_now date := current_date;
  v_cycle_start date;
  v_cycle_end date;
  v_anchor date;
begin
  if lower(coalesce(p_plan_tier,'')) = 'yearly' then
    v_anchor := coalesce(p_subscription_start_date, make_date(extract(year from v_now)::int, 1, 1));
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
    v_cycle_start := date_trunc('month', v_now)::date;
    v_cycle_end := (date_trunc('month', v_now) + interval '1 month')::date;
  end if;

  if lower(p_kind) = 'questions' then
    insert into public.user_plan_counters(user_id, cycle_start, cycle_end, questions_used, talk_minutes_used)
    values (p_user_id, v_cycle_start, v_cycle_end, greatest(1, p_inc), 0)
    on conflict (user_id, cycle_start) do update set
      questions_used = public.user_plan_counters.questions_used + greatest(1, p_inc),
      updated_at = now();
  elsif lower(p_kind) = 'minutes' then
    insert into public.user_plan_counters(user_id, cycle_start, cycle_end, questions_used, talk_minutes_used)
    values (p_user_id, v_cycle_start, v_cycle_end, 0, greatest(0, p_inc))
    on conflict (user_id, cycle_start) do update set
      talk_minutes_used = public.user_plan_counters.talk_minutes_used + greatest(0, p_inc),
      updated_at = now();
  else
    raise exception 'Unsupported kind: %', p_kind;
  end if;
end;
$$;



