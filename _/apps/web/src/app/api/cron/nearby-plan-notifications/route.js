import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { processDuePlanNotifications } from "@/app/api/utils/process-due-plan-notifications";

function isCronAuthorized(request) {
  try {
    const provided = request.headers.get("x-cron-secret");
    // Prefer a dedicated cron secret. Fallback to AUTH_SECRET for local/dev.
    const expected = process.env.CRON_SECRET || process.env.AUTH_SECRET;

    if (!provided || !expected) {
      return false;
    }

    return provided === expected;
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    // Cron secret gate (preferred). Falls back to an onboarded user session for manual testing.
    const cronOk = isCronAuthorized(request);
    if (!cronOk) {
      const gate = await requireOnboardedUser(sql, request);
      if (gate.error) {
        return Response.json({ error: gate.error }, { status: gate.status });
      }
    }

    const body = await request.json().catch(() => ({}));
    const limitRaw = body?.limit;
    const limit =
      typeof limitRaw === "number"
        ? limitRaw
        : parseInt(String(limitRaw || ""), 10);

    const result = await processDuePlanNotifications({
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return Response.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("POST /api/cron/nearby-plan-notifications error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request) {
  // Convenience for testing in a browser / curl.
  try {
    const cronOk = isCronAuthorized(request);
    if (!cronOk) {
      const gate = await requireOnboardedUser(sql, request);
      if (gate.error) {
        return Response.json({ error: gate.error }, { status: gate.status });
      }
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : NaN;

    const result = await processDuePlanNotifications({
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return Response.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("GET /api/cron/nearby-plan-notifications error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
