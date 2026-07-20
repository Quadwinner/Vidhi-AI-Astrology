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

export async function getUserFromAuth(admin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { user: null, error: 'Missing Authorization header' };
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { user: null, error: 'Authentication failed' };
  return { user, error: null };
}
