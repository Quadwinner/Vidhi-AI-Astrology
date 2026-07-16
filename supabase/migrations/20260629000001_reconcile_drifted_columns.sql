-- Reconcile columns that were added directly on the old dashboard but never
-- captured in migrations. Detected by diffing live old-DB data against the
-- migrated schema during the move to project "astro". Types inferred from the
-- old data values.

-- prices: per-plan wallet/coin credit granted on purchase
alter table public.prices
  add column if not exists wallet_credit_amount integer default 0;

-- system_prompts: prompt-cache bookkeeping (Gemini / Vertex) + A/B targeting
alter table public.system_prompts
  add column if not exists gemini_cache_expires_at                timestamptz,
  add column if not exists gemini_cache_name                      text,
  add column if not exists gemini_cache_token_count               integer,
  add column if not exists gemini_fallback_cache_expires_at       timestamptz,
  add column if not exists gemini_fallback_cache_name             text,
  add column if not exists gemini_fallback_cache_token_count      integer,
  add column if not exists max_age                                integer,
  add column if not exists min_age                                integer,
  add column if not exists priority                               integer,
  add column if not exists target_gender                         text,
  add column if not exists target_language                       text,
  add column if not exists vertex_cache_expires_at                timestamptz,
  add column if not exists vertex_cache_expires_at_flash_lite     timestamptz,
  add column if not exists vertex_cache_lock_until                text,
  add column if not exists vertex_cache_lock_until_flash_lite     text,
  add column if not exists vertex_cache_name                      text,
  add column if not exists vertex_cache_name_flash_lite           text,
  add column if not exists vertex_cache_token_count               integer,
  add column if not exists vertex_cache_token_count_flash_lite    integer;

-- blogs: presentation metadata
alter table public.blogs
  add column if not exists author_name    text,
  add column if not exists read_time_text text,
  add column if not exists special_tag    text;

-- plan_entitlements: the app defines a "free" tier that has no row in
-- subscription_plans, so the strict FK does not reflect real usage. Drop it
-- to match the old database's effective behaviour.
alter table public.plan_entitlements
  drop constraint if exists plan_entitlements_plan_id_fkey;
