import { requireUser } from "@/app/api/utils/require-user";
import sql from "@/app/api/utils/sql";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import {
  createCheckoutSession,
  getOrCreateCustomerByEmail,
  getOrCreatePriceForTier,
} from "@/app/api/utils/stripe-rest";

function cleanRedirectUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const { session } = await requireUser(request);
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive a stable userId for rate limiting (email is unique)
    const userEmail = session.user.email;
    const withinLimit = await consumeRateLimit(sql, {
      userId: userEmail, // email as key — billing/checkout uses session not userId
      action: "billing_checkout",
      windowSeconds: 3600,
      limit: 10,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many checkout attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const tier = typeof body?.tier === "string" ? body.tier : "";
    const redirectURL = cleanRedirectUrl(body?.redirectURL);

    if (!redirectURL) {
      return Response.json(
        { error: "redirectURL is required" },
        { status: 400 },
      );
    }

    const price = await getOrCreatePriceForTier(tier);
    if (!price?.priceId) {
      return Response.json({ error: "Invalid tier" }, { status: 400 });
    }

    const customer = await getOrCreateCustomerByEmail(session.user.email);
    if (!customer?.id) {
      return Response.json(
        { error: "Could not create customer" },
        { status: 500 },
      );
    }

    const successUrl = `${redirectURL}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = redirectURL;

    const checkout = await createCheckoutSession({
      customerId: customer.id,
      priceId: price.priceId,
      successUrl,
      cancelUrl,
    });

    if (!checkout?.url) {
      return Response.json(
        { error: "Could not create checkout" },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, url: checkout.url }, { status: 200 });
  } catch (err) {
    console.error("POST /api/billing/checkout error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
