import sql from "@/app/api/utils/sql";
import {
  getActiveTierForCustomer,
  getOrCreateCustomerByEmail,
} from "@/app/api/utils/stripe-rest";

function isFreshIapTierRow(row) {
  if (!row) {
    return false;
  }

  const tier = typeof row.app_tier === "string" ? row.app_tier : "";
  if (tier !== "free" && tier !== "plus" && tier !== "premium") {
    return false;
  }

  const source =
    typeof row.app_tier_source === "string" ? row.app_tier_source : "";
  if (source !== "iap") {
    return false;
  }

  const updated = row.app_tier_updated_at
    ? new Date(row.app_tier_updated_at)
    : null;
  if (!updated || Number.isNaN(updated.getTime())) {
    return false;
  }

  // Treat iOS IAP tier as authoritative, but require periodic refresh.
  // The mobile app re-claims after purchase/restore and on app open.
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  return updated.getTime() >= twoDaysAgo;
}

async function getCachedTierForEmail(email) {
  const safe = typeof email === "string" ? email.trim() : "";
  if (!safe) {
    return null;
  }

  try {
    const rows = await sql(
      `
      SELECT app_tier, app_tier_source, app_tier_updated_at
      FROM auth_users
      WHERE email = $1
      LIMIT 1
      `,
      [safe],
    );

    const row = rows?.[0] || null;
    if (isFreshIapTierRow(row)) {
      return row.app_tier;
    }

    return null;
  } catch (err) {
    console.error("Failed to read cached tier; defaulting to Stripe", err);
    return null;
  }
}

export async function getTierForSessionEmail(email) {
  const safe = typeof email === "string" ? email.trim() : "";
  if (!safe) {
    return "free";
  }

  const cached = await getCachedTierForEmail(safe);
  if (cached) {
    return cached;
  }

  try {
    const customer = await getOrCreateCustomerByEmail(safe);
    const customerId = customer?.id || null;
    const tierInfo = await getActiveTierForCustomer(customerId);
    return tierInfo?.tier || "free";
  } catch (err) {
    console.error("Failed to read Stripe tier; defaulting to free", err);
    return "free";
  }
}

export function normalizeTier(value) {
  const t = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (t === "premium" || t === "plus" || t === "free") {
    return t;
  }
  return "free";
}
