import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { sendExpoPush, sendExpoPushDebug } from "@/app/api/utils/push";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function cleanString(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const cap = Number.isFinite(maxLen) ? maxLen : 140;
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}

function getExpectedCronSecret() {
  // Prefer dedicated cron secret; fall back to AUTH_SECRET for local/dev convenience.
  const cron =
    typeof process.env.CRON_SECRET === "string" ? process.env.CRON_SECRET : "";
  if (cron) {
    return cron;
  }
  return typeof process.env.AUTH_SECRET === "string"
    ? process.env.AUTH_SECRET
    : "";
}

function isForceAllowed(request) {
  // 1) Never allow bypass in production unless caller proves knowledge of the cron secret.
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expected = getExpectedCronSecret();
  if (!expected) {
    return false;
  }

  const provided = request?.headers?.get("x-cron-secret") || "";
  return typeof provided === "string" && provided && provided === expected;
}

export async function POST(request) {
  try {
    const { session, userId } = await requireUser(request);

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "push_test",
      windowSeconds: 3600,
      limit: 10,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

        if (!session || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Safe by default.
    const forceRequested = body?.force === true;
    const force = forceRequested ? isForceAllowed(request) : false;

    if (forceRequested && !force) {
      return Response.json(
        { error: "Force push not allowed" },
        { status: 403 },
      );
    }

    const title = cleanString(body?.title, 80) || "Test push";

    const now = new Date();
    const fallbackBody = `Push test at ${now.toISOString()}`;
    const messageBody = cleanString(body?.body, 180) || fallbackBody;

    const rawData =
      body?.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data
        : {};

    const payload = {
      type: "debug_test",
      ...rawData,
    };

    const sender = force ? sendExpoPushDebug : sendExpoPush;

    const result = await sender(
      {
        userId,
        type: "debug_test",
        title,
        body: messageBody,
        data: payload,
      },
      force
        ? {
            bypassPrefs: true,
            bypassQuietHours: true,
          }
        : undefined,
    );

    return Response.json(
      {
        ok: true,
        force,
        userId,
        result,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/push/test error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
