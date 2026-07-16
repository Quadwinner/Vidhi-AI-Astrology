-- ============================================================
-- COMPLETE COUNTER SYSTEM SETUP
-- This creates EVERYTHING from scratch
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- PART 1: Create plan_entitlements table
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
  plan_id text PRIMARY KEY,
  questions_per_month integer NOT NULL DEFAULT 0,
  daily_horoscope_enabled boolean NOT NULL DEFAULT false,
  divisional_charts_enabled boolean NOT NULL DEFAULT false,
  ai_call_talk_minutes integer NOT NULL DEFAULT 0,
  weekly_forecasts_enabled boolean NOT NULL DEFAULT false,
  max_profiles integer NOT NULL DEFAULT 1,
  max_saved_threads integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

-- Enable RLS
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins full access (plan_entitlements)" ON public.plan_entitlements;
DROP POLICY IF EXISTS "Public read (plan_entitlements)" ON public.plan_entitlements;

-- Create policies
CREATE POLICY "Admins full access (plan_entitlements)" ON public.plan_entitlements
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_admin, false) = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_admin, false) = true));

CREATE POLICY "Public read (plan_entitlements)" ON public.plan_entitlements
  FOR SELECT USING (true);

-- Insert default entitlements
INSERT INTO public.plan_entitlements (plan_id, questions_per_month, ai_call_talk_minutes, max_profiles, max_saved_threads)
VALUES
  ('free', 100, 100, 1, 3),
  ('monthly', 500, 500, 3, 10),
  ('yearly', 1000, 1000, 5, 20)
ON CONFLICT (plan_id) DO UPDATE SET
  questions_per_month = EXCLUDED.questions_per_month,
  ai_call_talk_minutes = EXCLUDED.ai_call_talk_minutes,
  max_profiles = EXCLUDED.max_profiles,
  max_saved_threads = EXCLUDED.max_saved_threads,
  updated_at = now();


-- PART 2: Create user_plan_counters table
CREATE TABLE IF NOT EXISTS public.user_plan_counters (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  questions_used integer NOT NULL DEFAULT 0,
  talk_minutes_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cycle_start)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_plan_counters_current
  ON public.user_plan_counters(user_id, cycle_end);

-- Enable RLS
ALTER TABLE public.user_plan_counters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users read own counters" ON public.user_plan_counters;
DROP POLICY IF EXISTS "Admins full access (user_plan_counters)" ON public.user_plan_counters;
DROP POLICY IF EXISTS "Service role full access (user_plan_counters)" ON public.user_plan_counters;

-- Create policies
CREATE POLICY "Users read own counters" ON public.user_plan_counters
  FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_admin,false)));

CREATE POLICY "Admins full access (user_plan_counters)" ON public.user_plan_counters
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_admin,false)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND COALESCE(u.is_admin,false)));

-- CRITICAL: Policy to allow triggers to write
CREATE POLICY "Service role full access (user_plan_counters)" ON public.user_plan_counters
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- PART 3: Create counter increment function
CREATE OR REPLACE FUNCTION public.upsert_increment_counter_normalized(
  p_user_id uuid,
  p_plan_tier text,
  p_subscription_start_date date,
  p_kind text,
  p_inc integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now date := current_date;
  v_cycle_start date;
  v_cycle_end date;
  v_anchor date;
BEGIN
  -- Compute cycle boundaries
  IF lower(COALESCE(p_plan_tier,'')) = 'yearly' THEN
    v_anchor := COALESCE(
      p_subscription_start_date,
      make_date(extract(year FROM v_now)::int, 1, 1)
    );
    v_cycle_start := make_date(
      extract(year FROM v_now)::int,
      extract(month FROM v_anchor)::int,
      least(extract(day FROM v_anchor)::int, 28)
    );
    IF v_now < v_cycle_start THEN
      v_cycle_start := (v_cycle_start - interval '1 year')::date;
    END IF;
    v_cycle_end := (v_cycle_start + interval '1 year')::date;
  ELSE
    v_cycle_start := date_trunc('month', v_now)::date;
    v_cycle_end := (date_trunc('month', v_now) + interval '1 month')::date;
  END IF;

  RAISE NOTICE '[COUNTER] user=% plan=% kind=% inc=% cycle=%->%',
    p_user_id, p_plan_tier, p_kind, p_inc, v_cycle_start, v_cycle_end;

  -- Perform upsert
  IF lower(p_kind) = 'questions' THEN
    INSERT INTO public.user_plan_counters(
      user_id, cycle_start, cycle_end, questions_used, talk_minutes_used
    )
    VALUES (
      p_user_id, v_cycle_start, v_cycle_end, greatest(1, p_inc), 0
    )
    ON CONFLICT (user_id, cycle_start) DO UPDATE SET
      questions_used = public.user_plan_counters.questions_used + greatest(1, p_inc),
      updated_at = now();

    RAISE NOTICE '[COUNTER] Questions now: %',
      (SELECT questions_used FROM public.user_plan_counters
       WHERE user_id = p_user_id AND cycle_start = v_cycle_start);

  ELSIF lower(p_kind) = 'minutes' THEN
    INSERT INTO public.user_plan_counters(
      user_id, cycle_start, cycle_end, questions_used, talk_minutes_used
    )
    VALUES (
      p_user_id, v_cycle_start, v_cycle_end, 0, greatest(0, p_inc)
    )
    ON CONFLICT (user_id, cycle_start) DO UPDATE SET
      talk_minutes_used = public.user_plan_counters.talk_minutes_used + greatest(0, p_inc),
      updated_at = now();

    RAISE NOTICE '[COUNTER] Minutes now: %',
      (SELECT talk_minutes_used FROM public.user_plan_counters
       WHERE user_id = p_user_id AND cycle_start = v_cycle_start);

  ELSE
    RAISE EXCEPTION 'Unsupported kind: %', p_kind;
  END IF;

EXCEPTION
  WHEN others THEN
    RAISE WARNING '[COUNTER ERROR] user=%: % - %', p_user_id, SQLERRM, SQLSTATE;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_increment_counter_normalized TO authenticated, anon;


-- PART 4: Create chat trigger
CREATE OR REPLACE FUNCTION public.trg_inc_questions_on_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_start date;
BEGIN
  IF NEW.role = 'assistant' THEN
    SELECT plan_tier, subscription_start_date
    INTO v_plan, v_start
    FROM public.users
    WHERE id = NEW.user_id;

    RAISE NOTICE '[CHAT TRIGGER] Incrementing for user %, chat %, role %',
      NEW.user_id, NEW.id, NEW.role;

    PERFORM public.upsert_increment_counter_normalized(
      NEW.user_id,
      v_plan,
      v_start,
      'questions',
      1
    );

    RAISE NOTICE '[CHAT TRIGGER] Success for user %', NEW.user_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[CHAT TRIGGER ERROR] user=%: % - %', NEW.user_id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inc_questions_on_chat ON public.chat_history;
CREATE TRIGGER inc_questions_on_chat
  AFTER INSERT ON public.chat_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_inc_questions_on_chat();


-- PART 5: Create call trigger
CREATE OR REPLACE FUNCTION public.trg_inc_minutes_on_call_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_start date;
  v_seconds integer;
  v_minutes integer;
BEGIN
  IF tg_op = 'UPDATE'
     AND OLD.ended_at IS NULL
     AND NEW.ended_at IS NOT NULL THEN

    v_seconds := COALESCE(NEW.duration_seconds, 0);
    v_minutes := CASE
      WHEN v_seconds > 0 THEN greatest(1, ceil(v_seconds::numeric / 60))::int
      ELSE 0
    END;

    IF v_minutes > 0 THEN
      SELECT plan_tier, subscription_start_date
      INTO v_plan, v_start
      FROM public.users
      WHERE id = NEW.user_id;

      RAISE NOTICE '[CALL TRIGGER] Incrementing % min for user %, call %',
        v_minutes, NEW.user_id, NEW.id;

      PERFORM public.upsert_increment_counter_normalized(
        NEW.user_id,
        v_plan,
        v_start,
        'minutes',
        v_minutes
      );

      RAISE NOTICE '[CALL TRIGGER] Success for user %', NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[CALL TRIGGER ERROR] user=%: % - %', NEW.user_id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inc_minutes_on_call_end ON public.call_logs;
CREATE TRIGGER inc_minutes_on_call_end
  AFTER UPDATE OF ended_at ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_inc_minutes_on_call_end();


-- PART 6: Verify and Test
DO $$
DECLARE
  v_trigger_count int;
  v_policy_count int;
  test_user_id uuid;
  test_profile_id uuid;
  initial_count integer;
  final_count integer;
BEGIN
  -- Verify
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE t.tgname IN ('inc_questions_on_chat', 'inc_minutes_on_call_end');

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'user_plan_counters'
    AND policyname = 'Service role full access (user_plan_counters)';

  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Triggers: % (expected 2)', v_trigger_count;
  RAISE NOTICE 'RLS policy: % (expected 1)', v_policy_count;

  IF v_trigger_count != 2 OR v_policy_count != 1 THEN
    RAISE WARNING '✗ Installation incomplete!';
    RETURN;
  END IF;

  RAISE NOTICE '✓ All components installed!';

  -- Test
  SELECT u.id INTO test_user_id
  FROM public.users u
  WHERE u.email = 'shubhamkush0123@gmail.com';

  IF test_user_id IS NULL THEN
    RAISE WARNING '✗ Test user not found';
    RETURN;
  END IF;

  SELECT up.id INTO test_profile_id
  FROM public.user_profiles up
  WHERE up.user_id = test_user_id
  LIMIT 1;

  SELECT COALESCE(questions_used, 0) INTO initial_count
  FROM public.user_plan_counters
  WHERE user_id = test_user_id
    AND cycle_start = date_trunc('month', current_date)::date;

  RAISE NOTICE '=== TEST ===';
  RAISE NOTICE 'Initial: %', COALESCE(initial_count, 0);

  INSERT INTO public.chat_history (user_id, profile_id, role, message_content)
  VALUES (test_user_id, test_profile_id, 'assistant', '🧪 TEST - DELETE ME');

  SELECT COALESCE(questions_used, 0) INTO final_count
  FROM public.user_plan_counters
  WHERE user_id = test_user_id
    AND cycle_start = date_trunc('month', current_date)::date;

  RAISE NOTICE 'Final: %', COALESCE(final_count, 0);

  IF final_count > COALESCE(initial_count, 0) THEN
    RAISE NOTICE '✓✓✓ TEST PASSED! % → %', initial_count, final_count;
  ELSE
    RAISE WARNING '✗✗✗ TEST FAILED!';
  END IF;
END $$;


-- Show result
SELECT
  '=== FINAL CHECK ===' as status,
  u.email,
  COALESCE(c.questions_used, 0) as questions,
  COALESCE(c.talk_minutes_used, 0) as minutes
FROM public.users u
LEFT JOIN public.user_plan_counters c ON c.user_id = u.id
  AND c.cycle_start = date_trunc('month', current_date)::date
WHERE u.email = 'shubhamkush0123@gmail.com';
