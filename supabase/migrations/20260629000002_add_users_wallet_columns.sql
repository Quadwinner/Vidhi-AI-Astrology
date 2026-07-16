-- The old dashboard added wallet/pricing columns to public.users that were
-- never captured in migrations. The app (AuthContext, init-user-wallet,
-- deduct-call-coins, get-chat-answer, etc.) reads/writes these, so re-add them.
alter table public.users
  add column if not exists wallet_balance  integer not null default 0,
  add column if not exists currency_code   text,
  add column if not exists pricing_variant text default 'control';
