-- Each report type writes to its own column on profile_astro_data.
-- The function returns the full row as "ai_reports" to the frontend,
-- which reads ai_reports[report_key] to display each report.
alter table public.profile_astro_data
  add column if not exists basic_life_insight text,
  add column if not exists life_forecast_12_month text,
  add column if not exists destiny_blueprint text,
  add column if not exists career_mastery text,
  add column if not exists wealth_prosperity text,
  add column if not exists love_marriage text,
  add column if not exists relationship_compatibility text,
  add column if not exists health_vitality text,
  add column if not exists mind_inner_peace text,
  add column if not exists karma_life_purpose text,
  add column if not exists family_home_prosperity text;
