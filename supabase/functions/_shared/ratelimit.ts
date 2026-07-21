export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

export async function checkRateLimit(
  admin: any,
  userId: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();

  try {
    const { data, error } = await admin.rpc('increment_rate_limit', {
      p_user: userId,
      p_key: key,
      p_window_start: windowStart,
    });
    if (error) {
      console.error(`[ratelimit] ${key} rpc error (failing open): ${error.message}`);
      return { ok: true };
    }
    const count = typeof data === 'number' ? data : Array.isArray(data) ? Number(data[0]) : 0;
    if (count > max) {
      const retryAfter = Math.ceil((windowStartMs + windowMs - now) / 1000);
      return { ok: false, retryAfter: Math.max(1, retryAfter) };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[ratelimit] ${key} threw (failing open): ${(e as Error).message}`);
    return { ok: true };
  }
}
