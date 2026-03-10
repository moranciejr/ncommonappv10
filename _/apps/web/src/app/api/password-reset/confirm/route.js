import sql from "@/app/api/utils/sql";
import argon2 from "argon2";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    const password = body?.password;

    if (!token || typeof token !== "string") {
      return Response.json({ error: "Token is required" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const tokens = await sql`
      SELECT user_id
      FROM password_reset_tokens
      WHERE token = ${token}
        AND used = false
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (!tokens?.length) {
      return Response.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    const userId = tokens[0].user_id;
    const hashedPassword = await argon2.hash(password);

    await sql.transaction([
      sql`
        UPDATE auth_accounts
        SET password = ${hashedPassword}
        WHERE "userId" = ${userId}
          AND provider = 'credentials'
          AND type = 'credentials'
      `,
      sql`
        UPDATE password_reset_tokens
        SET used = true
        WHERE token = ${token}
      `,
    ]);

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/password-reset/confirm error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
