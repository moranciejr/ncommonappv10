import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { normalizeTier } from "@/app/api/utils/tier";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

export async function POST(request) {
  try {
    const { session, userId } = await requireUser(request);

    if (!session?.user?.email || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const okBurst = await consumeRateLimit(sql, {
      userId,
      action: "billing_claim_per_minute",
      windowSeconds: 60,
      limit: 5,
    });

    if (!okBurst) {
      return Response.json(
        { error: "Too many requests. Please try again." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);

    const tier = normalizeTier(body?.tier);
    // source is "iap" from mobile, "stripe" from web checkout
    const sourceRaw = typeof body?.source === "string" ? body.source.trim().toLowerCase() : "";
    const source = sourceRaw === "stripe" ? "stripe" : "iap";

    await sql(
      `
      UPDATE auth_users
      SET app_tier = $1,
          app_tier_source = $2,
          app_tier_updated_at = NOW()
      WHERE id = $3
      `,
      [tier, source, userId],
    );

    return Response.json(
      {
        ok: true,
        tier,
        source,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/billing/claim error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
