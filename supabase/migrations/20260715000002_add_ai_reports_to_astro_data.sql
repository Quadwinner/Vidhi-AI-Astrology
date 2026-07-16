-- profile_astro_data.ai_reports stores generated insight reports as JSONB
-- keyed by report_type (e.g. "insights_life_forecast", "insights_career_mastery").
-- The ReportsPage reads this to display unlocked reports.
alter table public.profile_astro_data
  add column if not exists ai_reports jsonb default '{}'::jsonb;
