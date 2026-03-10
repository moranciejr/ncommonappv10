import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function cleanToken(value) {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim();
  if (!token) {
    return null;
  }
  // Expo push tokens must start with ExponentPushToken[ or ExpoPushToken[
  const isValidFormat =
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[");
  if (!isValidFormat) {
    return null;
  }
  return token.length > 512 ? token.slice(0, 512) : token;
}

function cleanPlatform(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "ios" || v === "android") {
    return v;
  }
  return null;
}

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    if (!gate?.session || !gate?.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const token = cleanToken(body?.token);
    const platform = cleanPlatform(body?.platform);

    if (!token) {
      return Response.json({ error: "token is required and must be a valid Expo push token" }, { status: 400 });
    }

    if (!platform) {
      return Response.json(
        { error: "platform must be ios or android" },
        { status: 400 },
      );
    }

    const userId = gate.userId;

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "push_register",
      windowSeconds: 3600,
      limit: 20,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many token registrations. Try again later." },
        { status: 429 },
      );
    }

    // Upsert the token — if it already exists under a different user,
    // reassign it to the current user (device logged in as new account).
    const rows = await sql(
      `
      INSERT INTO public.push_tokens (
        user_id,
        token,
        platform,
        created_at,
        updated_at,
        last_seen_at,
        disabled_at
      )
      VALUES ($1, $2, $3, NOW(), NOW(), NOW(), NULL)
      ON CONFLICT (token)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = NOW(),
        last_seen_at = NOW(),
        disabled_at = NULL
      RETURNING id
      `,
      [userId, token, platform],
    );

    // Disable stale tokens for the current user on OTHER devices
    // that share the same token string — prevents ghost deliveries
    // when a token is recycled by the OS across installs.
    // Also disable duplicate tokens for other users now that this
    // token is owned by userId (the ON CONFLICT above already did this,
    // but belt-and-suspenders: mark any remaining stale rows disabled).
    try {
      await sql(
        `
        UPDATE public.push_tokens
        SET disabled_at = NOW()
        WHERE token = $1 AND user_id <> $2
        `,
        [token, userId],
      );
    } catch (_err) {
      // Non-fatal — old rows will be cleaned up by cron.
    }

    return Response.json(
      { ok: true, id: rows?.[0]?.id || null },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/push/register error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
