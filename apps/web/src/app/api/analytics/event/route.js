import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function clampText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const safe = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  return safe.length > maxLen ? safe.slice(0, maxLen) : safe;
}

function safeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userId = gate?.userId;

    if (!gate?.session || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit analytics events to prevent flooding (200/hour)
    const ok = await consumeRateLimit(sql, {
      userId,
      action: "analytics_events_per_hour",
      windowSeconds: 60 * 60,
      limit: 200,
    });
    if (!ok) {
      return Response.json({ ok: true }, { status: 200 }); // silent drop
    }

    const body = await request.json().catch(() => null);
    const name = clampText(body?.name, 64);
    const platform = clampText(body?.platform, 16);
    const properties = safeObject(body?.properties);

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    await sql(
      `
      INSERT INTO public.analytics_events (user_id, name, platform, properties)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [userId, name, platform || null, JSON.stringify(properties)],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/analytics/event error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
