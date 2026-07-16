-- Helper RPCs to upsert and increment counters atomically

create or replace function public.upsert_increment_questions_used(
  p_user_id uuid,
  p_cycle_start date,
  p_cycle_end date
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_plan_counters(user_id, cycle_start, cycle_end, questions_used, talk_minutes_used)
  values (p_user_id, p_cycle_start, p_cycle_end, 1, 0)
  on conflict (user_id, cycle_start) do update
    set questions_used = public.user_plan_counters.questions_used + 1,
        updated_at = now();
end;
$$;

create or replace function public.upsert_increment_talk_minutes_used(
  p_user_id uuid,
  p_cycle_start date,
  p_cycle_end date,
  p_minutes integer
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.user_plan_counters(user_id, cycle_start, cycle_end, questions_used, talk_minutes_used)
  values (p_user_id, p_cycle_start, p_cycle_end, 0, greatest(0, p_minutes))
  on conflict (user_id, cycle_start) do update
    set talk_minutes_used = public.user_plan_counters.talk_minutes_used + greatest(0, p_minutes),
        updated_at = now();
end;
$$;



