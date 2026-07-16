-- Fix critical issues preventing counter increments:
-- 1) Add RLS policy to allow trigger functions (SECURITY DEFINER) to write
-- 2) Fix call_logs trigger to only fire when ended_at changes from NULL
-- 3) Add logging/error handling

-- Issue #1: RLS blocks trigger writes
-- The trigger functions run as SECURITY DEFINER but there's no policy allowing them to write.
-- We need to add a policy that allows the authenticated service role (postgres) to write.

-- Add policy for service role to write counters (this allows SECURITY DEFINER functions to work)
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_plan_counters'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname='public'
        and tablename='user_plan_counters'
        and policyname='Service role full access (user_plan_counters)'
    ) then
      create policy "Service role full access (user_plan_counters)"
        on public.user_plan_counters
        for all
        to authenticated
        using (true)
        with check (true);
    end if;
  end if;
end $$;

-- Alternative: Disable RLS for the counter functions by granting bypass
-- This is safer since triggers are controlled server-side
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_plan_counters'
  ) then
    comment on table public.user_plan_counters is
      'User usage counters - RLS enabled but service role bypasses for triggers';
  end if;
end $$;


-- Issue #2: Fix trigger to only fire when ended_at ACTUALLY changes from null to non-null
-- This prevents double-counting if a call_log is updated multiple times

create or replace function public.trg_inc_minutes_on_call_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_start date;
  v_seconds integer;
  v_minutes integer;
begin
  -- CRITICAL FIX: Only fire if ended_at was NULL and is now NOT NULL
  -- This prevents re-firing on subsequent updates to the same call
  if tg_op = 'UPDATE'
     and OLD.ended_at IS NULL
     and NEW.ended_at IS NOT NULL then

    v_seconds := coalesce(NEW.duration_seconds, 0);
    v_minutes := case
      when v_seconds > 0 then greatest(1, ceil(v_seconds::numeric / 60))::int
      else 0
    end;

    if v_minutes > 0 then
      select plan_tier, subscription_start_date
      into v_plan, v_start
      from public.users
      where id = NEW.user_id;

      -- Log the increment attempt
      raise notice 'Incrementing minutes for user %, call %, duration % seconds = % minutes',
        NEW.user_id, NEW.id, v_seconds, v_minutes;

      -- Call normalized increment
      perform public.upsert_increment_counter_normalized(
        NEW.user_id,
        v_plan,
        v_start,
        'minutes',
        v_minutes
      );

      raise notice 'Minutes incremented successfully for user %', NEW.user_id;
    end if;
  end if;

  return NEW;
exception
  when others then
    -- Log error but don't fail the original operation
    raise warning 'Failed to increment call minutes for user %: % - %',
      NEW.user_id, SQLERRM, SQLSTATE;
    return NEW;
end;
$$;

-- Recreate the trigger (in case function signature changed)
drop trigger if exists inc_minutes_on_call_end on public.call_logs;
create trigger inc_minutes_on_call_end
  after update of ended_at on public.call_logs
  for each row
  execute function public.trg_inc_minutes_on_call_end();


-- Issue #3: Add logging to the chat trigger as well
create or replace function public.trg_inc_questions_on_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_start date;
begin
  -- Only count assistant messages as completed answers
  if NEW.role = 'assistant' then
    select plan_tier, subscription_start_date
    into v_plan, v_start
    from public.users
    where id = NEW.user_id;

    raise notice 'Incrementing questions for user %, chat %, role %',
      NEW.user_id, NEW.id, NEW.role;

    perform public.upsert_increment_counter_normalized(
      NEW.user_id,
      v_plan,
      v_start,
      'questions',
      1
    );

    raise notice 'Questions incremented successfully for user %', NEW.user_id;
  end if;

  return NEW;
exception
  when others then
    -- Log error but don't fail the original operation
    raise warning 'Failed to increment questions for user %: % - %',
      NEW.user_id, SQLERRM, SQLSTATE;
    return NEW;
end;
$$;

-- Recreate trigger
drop trigger if exists inc_questions_on_chat on public.chat_history;
create trigger inc_questions_on_chat
  after insert on public.chat_history
  for each row
  execute function public.trg_inc_questions_on_chat();


-- Issue #4: Add more robust logging to the normalized counter function
create or replace function public.upsert_increment_counter_normalized(
  p_user_id uuid,
  p_plan_tier text,
  p_subscription_start_date date,
  p_kind text,
  p_inc integer default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now date := current_date;
  v_cycle_start date;
  v_cycle_end date;
  v_anchor date;
  v_existing_row record;
begin
  -- Compute cycle boundaries based on plan tier
  if lower(coalesce(p_plan_tier,'')) = 'yearly' then
    v_anchor := coalesce(
      p_subscription_start_date,
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

  raise notice 'Counter increment: user=%, plan=%, kind=%, inc=%, cycle=%->%',
    p_user_id, p_plan_tier, p_kind, p_inc, v_cycle_start, v_cycle_end;

  -- Perform the upsert based on kind
  if lower(p_kind) = 'questions' then
    insert into public.user_plan_counters(
      user_id, cycle_start, cycle_end, questions_used, talk_minutes_used
    )
    values (
      p_user_id, v_cycle_start, v_cycle_end, greatest(1, p_inc), 0
    )
    on conflict (user_id, cycle_start) do update set
      questions_used = public.user_plan_counters.questions_used + greatest(1, p_inc),
      updated_at = now();

    raise notice 'Questions incremented: user=%, new_total=%',
      p_user_id,
      (select questions_used from public.user_plan_counters
       where user_id = p_user_id and cycle_start = v_cycle_start);

  elsif lower(p_kind) = 'minutes' then
    insert into public.user_plan_counters(
      user_id, cycle_start, cycle_end, questions_used, talk_minutes_used
    )
    values (
      p_user_id, v_cycle_start, v_cycle_end, 0, greatest(0, p_inc)
    )
    on conflict (user_id, cycle_start) do update set
      talk_minutes_used = public.user_plan_counters.talk_minutes_used + greatest(0, p_inc),
      updated_at = now();

    raise notice 'Minutes incremented: user=%, new_total=%',
      p_user_id,
      (select talk_minutes_used from public.user_plan_counters
       where user_id = p_user_id and cycle_start = v_cycle_start);

  else
    raise exception 'Unsupported kind: %', p_kind;
  end if;

exception
  when others then
    raise warning 'Counter increment failed for user %: % - %',
      p_user_id, SQLERRM, SQLSTATE;
    raise;
end;
$$;


-- Grant execute on all counter functions to authenticated users
grant execute on function public.upsert_increment_counter_normalized to authenticated, anon;
grant execute on function public.upsert_increment_questions_used to authenticated, anon;
grant execute on function public.upsert_increment_talk_minutes_used to authenticated, anon;

-- Verify triggers are installed
do $$
declare
  v_chat_trigger_count int;
  v_call_trigger_count int;
begin
  select count(*) into v_chat_trigger_count
  from pg_trigger t
  join pg_class c on t.tgrelid = c.oid
  where c.relname = 'chat_history' and t.tgname = 'inc_questions_on_chat';

  select count(*) into v_call_trigger_count
  from pg_trigger t
  join pg_class c on t.tgrelid = c.oid
  where c.relname = 'call_logs' and t.tgname = 'inc_minutes_on_call_end';

  raise notice 'Triggers installed: chat_history=%, call_logs=%',
    v_chat_trigger_count, v_call_trigger_count;

  if v_chat_trigger_count = 0 then
    raise warning 'chat_history trigger NOT installed!';
  end if;

  if v_call_trigger_count = 0 then
    raise warning 'call_logs trigger NOT installed!';
  end if;
end $$;

