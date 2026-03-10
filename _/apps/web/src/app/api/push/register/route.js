import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";

function cleanToken(value) {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim();
  if (!token) {
    return null;
  }
  // Expo push tokens are usually short; keep a reasonable cap.
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
      return Response.json({ error: "token is required" }, { status: 400 });
    }

    if (!platform) {
      return Response.json(
        { error: "platform must be ios or android" },
        { status: 400 },
      );
    }

    const userId = gate.userId;

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

    return Response.json(
      { ok: true, id: rows?.[0]?.id || null },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/push/register error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
