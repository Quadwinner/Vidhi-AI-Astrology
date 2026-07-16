-- Recover tables that existed in the old Supabase project (created directly in
-- the dashboard) but were never captured as migration files. Schemas are
-- reverse-engineered from live data samples and application code, because the
-- old database's DDL was not accessible during the migration to project "astro".
--
-- Config tables (supported_currencies, service_prices, wallet_packages,
-- system_settings) get public SELECT to match the old behaviour the frontend
-- relies on. Data/transaction tables are secured (owner + admin), NOT left
-- world-readable like the old `payments` table was.

-- ---------------------------------------------------------------------------
-- 1. supported_currencies  (config — public read)
-- ---------------------------------------------------------------------------
create table if not exists public.supported_currencies (
  code            text primary key,
  name            text not null,
  symbol          text,
  decimal_places  integer not null default 2,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. service_prices  (config — public read)
-- ---------------------------------------------------------------------------
create table if not exists public.service_prices (
  id            uuid primary key default gen_random_uuid(),
  service_key   text not null,
  currency_code text not null,
  price_amount  integer not null default 0,
  variant_name  text not null default 'control',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_service_prices_lookup
  on public.service_prices (currency_code, variant_name);

-- ---------------------------------------------------------------------------
-- 3. wallet_packages  (config — public read)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_packages (
  id               uuid primary key default gen_random_uuid(),
  currency_code    text not null,
  amount           integer not null,        -- coins/credits granted
  price            integer not null,        -- price in currency minor units
  display_order    integer not null default 0,
  is_active        boolean not null default true,
  is_popular       boolean not null default false,
  variant_name     text not null default 'control',
  apple_product_id text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_wallet_packages_lookup
  on public.wallet_packages (currency_code, is_active, variant_name, display_order);

-- ---------------------------------------------------------------------------
-- 4. system_settings  (config / feature flags — public read)
-- ---------------------------------------------------------------------------
create table if not exists public.system_settings (
  setting_name text primary key,
  is_active    boolean not null default false,
  description  text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. payments  (transactional — schema only, owner + admin read)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users(id) on delete set null,
  amount             integer not null,
  currency           text not null,
  product_type       text,
  product_details    jsonb,
  payment_gateway    text,
  gateway_payment_id text,
  gateway_order_id   text,
  status             text,
  invoice_number     text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_payments_user_id on public.payments (user_id);
create index if not exists idx_payments_gateway_payment_id on public.payments (gateway_payment_id);
create index if not exists idx_payments_status on public.payments (status);

-- ---------------------------------------------------------------------------
-- 6. compatibility_profiles  (user data — schema only, owner-managed)
-- ---------------------------------------------------------------------------
create table if not exists public.compatibility_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.users(id) on delete cascade,
  source_profile_id uuid references public.user_profiles(id) on delete cascade,
  partner_name      text not null,
  partner_gender    text,
  date_of_birth     date,
  time_of_birth     time,
  birth_place       text,
  birth_lat         double precision,
  birth_lng         double precision,
  birth_timezone    text,
  d1_chart          jsonb,
  d9_chart          jsonb,
  d10_chart         jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_compat_profiles_user on public.compatibility_profiles (user_id);
create index if not exists idx_compat_profiles_source on public.compatibility_profiles (source_profile_id);

-- ---------------------------------------------------------------------------
-- 7. llm_api_costs  (logging — schema only, service_role/admin)
-- ---------------------------------------------------------------------------
create table if not exists public.llm_api_costs (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid,
  profile_id                  uuid,
  chat_history_id             uuid,
  model_name                  text,
  input_tokens                integer,
  output_tokens               integer,
  cache_creation_input_tokens integer,
  cache_read_input_tokens     integer,
  total_cost_usd              numeric(18,8),
  total_cost_inr              numeric(18,6),
  created_at                  timestamptz not null default now()
);
create index if not exists idx_llm_api_costs_chat on public.llm_api_costs (chat_history_id);

-- ---------------------------------------------------------------------------
-- 8. web_push_campaigns  (logging — schema only, service_role/admin)
-- ---------------------------------------------------------------------------
create table if not exists public.web_push_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  title              text,
  message            text,
  icon_url           text,
  click_url          text,
  segment            text,
  test_email         text,
  created_by         uuid,
  clevertap_response jsonb,
  sent_at            timestamptz,
  created_at         timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

-- Config tables: world-readable (frontend uses the anon key), writes via service_role.
alter table public.supported_currencies enable row level security;
alter table public.service_prices       enable row level security;
alter table public.wallet_packages      enable row level security;
alter table public.system_settings      enable row level security;

create policy "public read supported_currencies" on public.supported_currencies for select using (true);
create policy "public read service_prices"        on public.service_prices       for select using (true);
create policy "public read wallet_packages"       on public.wallet_packages      for select using (true);
create policy "public read system_settings"       on public.system_settings      for select using (true);

-- payments: owner reads own; admins read all; writes via service_role only.
alter table public.payments enable row level security;
create policy "users read own payments" on public.payments
  for select to authenticated using (user_id = auth.uid());
create policy "admins read all payments" on public.payments
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true));

-- compatibility_profiles: owner manages own rows.
alter table public.compatibility_profiles enable row level security;
create policy "users manage own compatibility_profiles" on public.compatibility_profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Logging tables: no anon/authenticated access; service_role bypasses RLS.
alter table public.llm_api_costs      enable row level security;
alter table public.web_push_campaigns enable row level security;
