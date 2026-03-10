import sql from "@/app/api/utils/sql";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

export async function POST(request) {
  try {
    // Rate limit confirms to prevent token brute-forcing
    // Use a fixed sentinel key — this endpoint has no userId yet
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipKey = `ip:${clientIp}`.slice(0, 64);
    const ok = await consumeRateLimit(sql, {
      userId: ipKey,
      action: "email_verify_confirm_per_hour",
      windowSeconds: 60 * 60,
      limit: 20,
    });
    if (!ok) {
      return Response.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const token = body?.token;

    if (!token || typeof token !== "string") {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }

    const tokens = await sql`
      SELECT user_id
      FROM email_verification_tokens
      WHERE token = ${token}
        AND used = false
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (!tokens?.length) {
      return Response.json(
        { error: "Invalid or expired verification token" },
        { status: 400 },
      );
    }

    const userId = tokens[0].user_id;

    await sql.transaction([
      sql`
        UPDATE auth_users
        SET "emailVerified" = NOW()
        WHERE id = ${userId}
      `,
      sql`
        UPDATE email_verification_tokens
        SET used = true
        WHERE token = ${token}
      `,
    ]);

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/email-verification/confirm error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
