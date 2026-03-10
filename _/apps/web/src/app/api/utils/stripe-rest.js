function requireStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return key;
}

async function stripeRequest(
  path,
  { method = "GET", form = null, query = null } = {},
) {
  const key = requireStripeKey();
  const url = new URL(`https://api.stripe.com${path}`);

  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          url.searchParams.append(k, String(item));
        }
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const headers = {
    Authorization: `Bearer ${key}`,
  };

  let body = undefined;
  if (form && typeof form === "object") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    body = params.toString();
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    const err = new Error(
      `Stripe API ${method} ${path} failed: [${res.status}] ${message}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function getOrCreatePriceForTier(tier) {
  const normalized = typeof tier === "string" ? tier.trim().toLowerCase() : "";
  if (normalized !== "plus" && normalized !== "premium") {
    return null;
  }

  const lookupKey =
    normalized === "plus" ? "ncommon_plus_monthly" : "ncommon_premium_monthly";

  // Try to reuse a price via lookup_key.
  const existing = await stripeRequest("/v1/prices", {
    method: "GET",
    query: {
      active: "true",
      "lookup_keys[]": [lookupKey],
      "expand[]": ["data.product"],
      limit: "1",
    },
  });

  const found = existing?.data?.[0];
  if (found?.id) {
    return { priceId: found.id, lookupKey };
  }

  // Create product + price.
  const productName =
    normalized === "plus" ? "nCommon Plus" : "nCommon Premium";
  const unitAmount = normalized === "plus" ? 699 : 1499;

  const product = await stripeRequest("/v1/products", {
    method: "POST",
    form: {
      name: productName,
      "metadata[tier]": normalized,
    },
  });

  const price = await stripeRequest("/v1/prices", {
    method: "POST",
    form: {
      currency: "usd",
      unit_amount: String(unitAmount),
      "recurring[interval]": "month",
      product: product.id,
      lookup_key: lookupKey,
    },
  });

  return { priceId: price.id, lookupKey };
}

export async function getOrCreateCustomerByEmail(email) {
  if (!email) {
    return null;
  }

  // Search is the cleanest way to avoid storing stripe_customer_id in our DB.
  // https://stripe.com/docs/search
  const safeEmail = String(email).replace(/'/g, "\\'");
  const query = `email:'${safeEmail}'`;

  try {
    const search = await stripeRequest("/v1/customers/search", {
      method: "GET",
      query: { query, limit: "1" },
    });

    const existing = search?.data?.[0];
    if (existing?.id) {
      return existing;
    }
  } catch (err) {
    // Some Stripe accounts may not have Search enabled.
    console.error("Stripe customer search failed; falling back to create", err);
  }

  const created = await stripeRequest("/v1/customers", {
    method: "POST",
    form: { email: String(email) },
  });

  return created;
}

export async function createCheckoutSession({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
}) {
  if (!customerId || !priceId || !successUrl || !cancelUrl) {
    return null;
  }

  // Stripe expects nested form keys.
  const session = await stripeRequest("/v1/checkout/sessions", {
    method: "POST",
    form: {
      mode: "subscription",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      // Let Stripe collect tax/location if you turn it on later.
    },
  });

  return session;
}

export async function getActiveTierForCustomer(customerId) {
  if (!customerId) {
    return { tier: "free", status: "none" };
  }

  const subs = await stripeRequest("/v1/subscriptions", {
    method: "GET",
    query: {
      customer: customerId,
      status: "all",
      limit: "10",
      "expand[]": ["data.items.data.price"],
    },
  });

  const list = Array.isArray(subs?.data) ? subs.data : [];

  // Find the best active subscription.
  const activeStatuses = new Set(["active", "trialing"]);
  const active = list.filter((s) => activeStatuses.has(s.status));

  let foundTier = "free";
  let foundStatus = "none";
  let currentPeriodEnd = null;

  for (const s of active) {
    const items = s?.items?.data || [];
    const lookupKeys = items.map((it) => it?.price?.lookup_key).filter(Boolean);

    if (lookupKeys.includes("ncommon_premium_monthly")) {
      foundTier = "premium";
      foundStatus = s.status;
      currentPeriodEnd = s.current_period_end
        ? Number(s.current_period_end)
        : null;
      break;
    }

    if (lookupKeys.includes("ncommon_plus_monthly")) {
      foundTier = "plus";
      foundStatus = s.status;
      currentPeriodEnd = s.current_period_end
        ? Number(s.current_period_end)
        : null;
      // keep looking in case premium exists
    }
  }

  return { tier: foundTier, status: foundStatus, currentPeriodEnd };
}
