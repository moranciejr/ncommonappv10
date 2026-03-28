/**
 * Simple rate limiter using the rate_limit_counters table.
 * Returns true if the action is allowed, false if rate limited.
 */
export async function consumeRateLimit(sql, { userId, action, windowSeconds, limit }) {
  try {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const rows = await sql(
      `INSERT INTO rate_limit_counters (user_id, action, window_start, count)
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT (user_id, action, window_start)
       DO UPDATE SET count = rate_limit_counters.count + 1
       RETURNING count`,
      [userId, action]
    );

    const count = rows?.[0]?.count || 1;
    return count <= limit;
  } catch (err) {
    console.error('rate limit error', err);
    return true; // fail open
  }
}
