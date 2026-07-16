-- Triggers to guarantee counters increment at the DB layer

-- 1) Chat: after assistant message stored
create or replace function public.trg_inc_questions_on_chat()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_start date;
begin
  -- Only count assistant messages as completed answers
  if new.role = 'assistant' then
    select plan_tier, subscription_start_date into v_plan, v_start
    from public.users where id = new.user_id;
    perform public.upsert_increment_counter_normalized(new.user_id, v_plan, v_start, 'questions', 1);
  end if;
  return new;
end;
$$;

drop trigger if exists inc_questions_on_chat on public.chat_history;
create trigger inc_questions_on_chat
after insert on public.chat_history
for each row execute function public.trg_inc_questions_on_chat();

-- 2) Calls: after a call obtains ended_at, use duration_seconds
create or replace function public.trg_inc_minutes_on_call_end()
returns trigger
language plpgsql
security definer
as $$
declare
  v_plan text;
  v_start date;
  v_seconds integer;
  v_minutes integer;
begin
  if new.ended_at is not null and (tg_op = 'UPDATE') then
    v_seconds := coalesce(new.duration_seconds, 0);
    v_minutes := case when v_seconds > 0 then greatest(1, ceil(v_seconds::numeric / 60))::int else 0 end;
    if v_minutes > 0 then
      select plan_tier, subscription_start_date into v_plan, v_start
      from public.users where id = new.user_id;
      perform public.upsert_increment_counter_normalized(new.user_id, v_plan, v_start, 'minutes', v_minutes);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inc_minutes_on_call_end on public.call_logs;
create trigger inc_minutes_on_call_end
after update of ended_at on public.call_logs
for each row execute function public.trg_inc_minutes_on_call_end();



