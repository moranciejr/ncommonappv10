import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function parseUserId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function cleanText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (!trimmed) {
    return "";
  }
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

export async function POST(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    // Basic abuse caps.
    const okHour = await consumeRateLimit(sql, {
      userId,
      action: "reports_per_hour",
      windowSeconds: 60 * 60,
      limit: 6,
    });
    const okDay = await consumeRateLimit(sql, {
      userId,
      action: "reports_per_day",
      windowSeconds: 24 * 60 * 60,
      limit: 20,
    });

    if (!okHour || !okDay) {
      return Response.json(
        { error: "Too many reports. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const targetUserId = parseUserId(body?.targetUserId);
    const reason = cleanText(body?.reason, 64);
    const details = cleanText(body?.details, 1000);

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    if (targetUserId === userId) {
      return Response.json(
        { error: "You cannot report yourself" },
        { status: 400 },
      );
    }

    if (!reason) {
      return Response.json({ error: "reason is required" }, { status: 400 });
    }

    await sql(
      `
      INSERT INTO user_reports (reporter_user_id, target_user_id, reason, details)
      VALUES ($1, $2, $3, $4)
      `,
      [userId, targetUserId, reason, details],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/reports error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
