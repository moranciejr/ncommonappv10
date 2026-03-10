function getWindowStartIso(windowSeconds) {
  const ws = typeof windowSeconds === "number" ? windowSeconds : 0;
  const s = Number.isFinite(ws) && ws > 0 ? Math.floor(ws) : 60;
  const nowMs = Date.now();
  const windowMs = s * 1000;
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  return new Date(startMs).toISOString();
}

export async function consumeRateLimit(
  sqlClient,
  { userId, action, windowSeconds, limit },
) {
  if (!userId) {
    return true;
  }

  const safeAction =
    typeof action === "string" ? action.trim().slice(0, 64) : "";
  if (!safeAction) {
    return true;
  }

  const ws = typeof windowSeconds === "number" ? Math.floor(windowSeconds) : 60;
  const safeWindowSeconds = Number.isFinite(ws) && ws > 0 ? ws : 60;

  const lim = typeof limit === "number" ? Math.floor(limit) : 1;
  const safeLimit = Number.isFinite(lim) && lim > 0 ? lim : 1;

  const windowStart = getWindowStartIso(safeWindowSeconds);

  // Atomic increment-if-below-limit.
  const rows = await sqlClient(
    `
    INSERT INTO public.rate_limit_counters (user_id, action, window_start, window_seconds, count)
    VALUES ($1, $2, $3, $4, 1)
    ON CONFLICT (user_id, action, window_start, window_seconds)
    DO UPDATE
      SET count = public.rate_limit_counters.count + 1,
          updated_at = NOW()
      WHERE public.rate_limit_counters.count < $5
    RETURNING count
    `,
    [userId, safeAction, windowStart, safeWindowSeconds, safeLimit],
  );

  return Array.isArray(rows) && rows.length > 0;
}
