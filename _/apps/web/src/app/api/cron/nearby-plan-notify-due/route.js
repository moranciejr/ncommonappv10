import sql from "@/app/api/utils/sql";
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
    // Secret-protected: meant for a real external scheduler hitting this endpoint.
    if (!isCronAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("POST /api/cron/nearby-plan-notify-due error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request) {
  // Convenience: allows curl testing with the same secret header.
  try {
    if (!isCronAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? parseInt(limitRaw, 10) : NaN;

    const result = await processDuePlanNotifications({
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return Response.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("GET /api/cron/nearby-plan-notify-due error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
