-- Ensure triggers can write counters and prevent double-counting on call end

do $$ begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='user_plan_counters' and policyname='Service role full access (user_plan_counters)'
  ) then
    create policy "Service role full access (user_plan_counters)" on public.user_plan_counters
      for all to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Refine call end trigger: fire only when ended_at changes from NULL -> NOT NULL
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
  if TG_OP = 'UPDATE' and NEW.ended_at is not null and OLD.ended_at is null then
    v_seconds := coalesce(NEW.duration_seconds, 0);
    v_minutes := case when v_seconds > 0 then greatest(1, ceil(v_seconds::numeric / 60))::int else 0 end;
    if v_minutes > 0 then
      select coalesce(plan_tier, 'free'), subscription_start_date into v_plan, v_start
      from public.users where id = NEW.user_id;
      perform public.upsert_increment_counter_normalized(NEW.user_id, v_plan, v_start, 'minutes', v_minutes);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists inc_minutes_on_call_end on public.call_logs;
create trigger inc_minutes_on_call_end
  after update of ended_at on public.call_logs
  for each row execute function public.trg_inc_minutes_on_call_end();


