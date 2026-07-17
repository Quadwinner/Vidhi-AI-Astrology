-- Cache the "current transits" result so we only hit the VedicAstro API once per
-- profile per day, instead of on every Reports/Dashboard load.
-- current_transits_cache stores { table, svg }; current_transits_date is the day it was fetched.
alter table public.profile_astro_data
  add column if not exists current_transits_cache jsonb,
  add column if not exists current_transits_date date;
