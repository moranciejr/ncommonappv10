import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

export async function POST(request) {
  try {
    const { session } = await requireUser(request);
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const withinLimit = await consumeRateLimit(sql, {
      userId: session.user.email,
      action: "billing_status",
      windowSeconds: 60,
      limit: 30,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

    const tier = await getTierForSessionEmail(session.user.email);

    return Response.json(
      {
        ok: true,
        tier,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/billing/status error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
