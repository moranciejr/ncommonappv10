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

    // Rate limit crash reports to prevent log flooding (30/hour)
    const ok = await consumeRateLimit(sql, {
      userId,
      action: "crash_reports_per_hour",
      windowSeconds: 60 * 60,
      limit: 30,
    });
    if (!ok) {
      return Response.json({ ok: true }, { status: 200 }); // silent drop
    }

    const body = await request.json().catch(() => null);

    const platform = clampText(body?.platform, 16);
    const message = clampText(body?.message, 2000);
    const stack = clampText(body?.stack, 12000);
    const context = safeObject(body?.context);

    await sql(
      `
      INSERT INTO public.crash_reports (user_id, platform, message, stack, context)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      `,
      [
        userId,
        platform || null,
        message || null,
        stack || null,
        JSON.stringify(context),
      ],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/analytics/crash error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
