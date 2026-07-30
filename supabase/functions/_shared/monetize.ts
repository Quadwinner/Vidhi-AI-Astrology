export interface GateResult {
  ok: boolean;
  status?: number;
  payload?: Record<string, unknown>;
  useFree?: boolean;
  cost?: number;
  currency?: string;
  balance?: number;
  freeUsed?: number;
  freeLimit?: number;
}

export async function checkGate(
  admin: any,
  userId: string,
  featureKey: string,
  freeSettingKey: string,
  defaultFree: number,
): Promise<GateResult> {
  const { data: dbUser, error: userError } = await admin
    .from('users')
    .select('currency_code, wallet_balance, subscription_status')
    .eq('id', userId)
    .single();
  if (userError || !dbUser) return { ok: false, status: 500, payload: { error: 'User fetch failed' } };

  const currency = dbUser.currency_code || 'USD';
  const balance = dbUser.wallet_balance || 0;
  const isPremium = dbUser.subscription_status === 'active';

  const { data: usageRow } = await admin
    .from('feature_usage')
    .select('used_count')
    .eq('user_id', userId)
    .eq('feature_key', featureKey)
    .maybeSingle();
  const freeUsed = usageRow?.used_count || 0;

  const { data: freeSetting } = await admin
    .from('settings').select('value').eq('key', freeSettingKey).maybeSingle();
  const freeLimit = Number.parseInt(freeSetting?.value ?? '', 10) || defaultFree;

  const useFree = isPremium && freeUsed < freeLimit;

  if (useFree) {
    return { ok: true, useFree: true, cost: 0, currency, balance, freeUsed, freeLimit };
  }

  const { data: priceRows } = await admin
    .from('service_prices')
    .select('price_amount')
    .eq('service_key', featureKey)
    .eq('currency_code', currency)
    .order('price_amount', { ascending: true })
    .limit(1);
  if (!priceRows || priceRows.length === 0) {
    return { ok: false, status: 500, payload: { error: 'price_missing' } };
  }
  const cost = priceRows[0].price_amount;
  if (balance < cost) {
    return {
      ok: false, status: 402,
      payload: {
        error: 'insufficient_funds',
        message: 'You don\u2019t have enough balance for this. Please recharge and try again.',
        required: cost, balance, currency,
      },
    };
  }
  return { ok: true, useFree: false, cost, currency, balance, freeUsed, freeLimit };
}

export async function commitGate(
  admin: any,
  userId: string,
  featureKey: string,
  gate: GateResult,
): Promise<Record<string, unknown>> {
  let newBalance = gate.balance || 0;
  let newFreeUsed = gate.freeUsed || 0;

  if (gate.useFree) {
    newFreeUsed = (gate.freeUsed || 0) + 1;
    await admin.from('feature_usage')
      .upsert({ user_id: userId, feature_key: featureKey, used_count: newFreeUsed }, { onConflict: 'user_id,feature_key' });
  } else {
    newBalance = (gate.balance || 0) - (gate.cost || 0);
    await admin.from('users').update({ wallet_balance: newBalance }).eq('id', userId);
  }

  const freeLimit = gate.freeLimit || 0;
  const isPremium = (gate.freeLimit || 0) > 0 && gate.useFree !== undefined;
  return {
    charged: !gate.useFree,
    cost: gate.useFree ? 0 : (gate.cost || 0),
    currency: gate.currency,
    wallet_balance: newBalance,
    free_draws_limit: freeLimit,
    free_draws_used: newFreeUsed,
    free_draws_remaining: Math.max(0, freeLimit - newFreeUsed),
  };
}

export async function isProfileFirstQuestion(admin: any, profileId: string): Promise<boolean> {
  const { count, error } = await admin
    .from('chat_history')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('role', 'user');
  if (error) {
    console.error('[monetize] Failed to check first question:', error);
    return false;
  }
  return (count ?? 0) === 0;
}

export interface CycleAllowance {
  planTier: string;
  questionsUsed: number;
  talkMinutesUsed: number;
  questionsRemaining: number;
  talkMinutesRemaining: number;
  questionsPerMonth: number;
  aiCallTalkMinutes: number;
}

export function hasActiveSubscription(planTier: string | null | undefined, subscriptionStatus: string | null | undefined): boolean {
  const tier = (planTier || 'free').toLowerCase();
  return (tier === 'monthly' || tier === 'yearly') && subscriptionStatus === 'active';
}

export async function getCycleAllowance(admin: any, userId: string): Promise<CycleAllowance | null> {
  const { data, error } = await admin.rpc('get_current_cycle_counters', { p_user_id: userId });
  if (error || !data || data.length === 0) {
    console.error('[monetize] Failed to fetch cycle counters:', error);
    return null;
  }

  const row = data[0];
  return {
    planTier: row.plan_tier || 'free',
    questionsUsed: row.questions_used ?? 0,
    talkMinutesUsed: row.talk_minutes_used ?? 0,
    questionsRemaining: row.questions_remaining ?? 0,
    talkMinutesRemaining: row.talk_minutes_remaining ?? 0,
    questionsPerMonth: row.questions_per_month ?? 0,
    aiCallTalkMinutes: row.ai_call_talk_minutes ?? 0,
  };
}

export async function shouldChargeWalletForChat(
  admin: any,
  userId: string,
  profileId: string,
): Promise<{ charge: boolean; reason: string }> {
  if (await isProfileFirstQuestion(admin, profileId)) {
    return { charge: false, reason: 'first_question' };
  }

  const { data: user, error } = await admin
    .from('users')
    .select('plan_tier, subscription_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { charge: true, reason: 'user_not_found' };
  }

  if (!hasActiveSubscription(user.plan_tier, user.subscription_status)) {
    return { charge: true, reason: 'free_tier' };
  }

  const allowance = await getCycleAllowance(admin, userId);
  if (allowance && allowance.questionsRemaining > 0) {
    return { charge: false, reason: 'subscription_allowance' };
  }

  return { charge: true, reason: 'allowance_exhausted' };
}

export async function shouldChargeWalletForCallMinute(
  admin: any,
  userId: string,
  durationSeconds: number,
): Promise<{ charge: boolean; reason: string }> {
  const { data: user, error } = await admin
    .from('users')
    .select('plan_tier, subscription_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return { charge: true, reason: 'user_not_found' };
  }

  if (!hasActiveSubscription(user.plan_tier, user.subscription_status)) {
    return { charge: true, reason: 'free_tier' };
  }

  const allowance = await getCycleAllowance(admin, userId);
  if (!allowance) {
    return { charge: true, reason: 'allowance_lookup_failed' };
  }

  const minutesInCurrentCall = Math.floor(durationSeconds / 60);
  const effectiveRemaining = allowance.talkMinutesRemaining - minutesInCurrentCall;
  if (effectiveRemaining > 0) {
    return { charge: false, reason: 'subscription_allowance' };
  }

  return { charge: true, reason: 'allowance_exhausted' };
}

export async function getUserFromAuth(admin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { user: null, error: 'Missing Authorization header' };
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Authentication failed' };
  return { user, error: null };
}
