import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
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
