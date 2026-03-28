/**
 * Returns the subscription tier for a user.
 * For now defaults to 'free' — wire up billing later.
 */
export async function getTierForSessionEmail(email) {
  return 'free';
}

export async function getTierForUserId(sql, userId) {
  try {
    const rows = await sql(
      `SELECT tier FROM user_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return rows?.[0]?.tier || 'free';
  } catch {
    return 'free';
  }
}
