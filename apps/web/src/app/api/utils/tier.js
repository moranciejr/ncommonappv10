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

export function normalizeTier(tier) {
  if (tier === 'plus' || tier === 'premium') return tier;
  return 'free';
}

export function tierFromSubscriptionStatus(status) {
  if (!status) return 'free';
  if (status === 'active' || status === 'trialing') return 'plus';
  return 'free';
}
