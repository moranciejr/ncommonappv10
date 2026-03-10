import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { sendEmail } from "@/app/api/utils/send-email";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const email = body?.email;

    if (!email || typeof email !== "string") {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Do not reveal if the email exists. Always return success.
    const rows = await sql`
      SELECT u.id
      FROM auth_users u
      JOIN auth_accounts a ON a."userId" = u.id
      WHERE u.email = ${email}
        AND a.provider = 'credentials'
        AND a.type = 'credentials'
      LIMIT 1
    `;

    if (!rows?.length) {
      return Response.json({ ok: true }, { status: 200 });
    }

    const userId = rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");

    await sql`
      INSERT INTO password_reset_tokens (token, user_id, expires_at)
      VALUES (${token}, ${userId}, NOW() + INTERVAL '1 hour')
    `;

    // Build a public URL that matches the current environment.
    const originFromRequest = new URL(request.url).origin;
    const baseUrl =
      process.env.AUTH_URL || process.env.APP_URL || originFromRequest;
    const resetLink = new URL(
      `/reset-password?token=${encodeURIComponent(token)}`,
      baseUrl,
    ).toString();

    // Send via Resend (if configured). If not configured, fall back to dev link in development.
    if (process.env.RESEND_API_KEY) {
      try {
        await sendEmail({
          to: email,
          from: "nCommon <onboarding@resend.dev>",
          subject: "Reset your nCommon password",
          text: `Reset your password using this link: ${resetLink}`,
          html: `
            <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
              <h2 style="margin: 0 0 12px;">Reset your password</h2>
              <p style="margin: 0 0 16px;">Click the button below to set a new password for your nCommon account.</p>
              <p style="margin: 0 0 16px;">
                <a href="${resetLink}" style="display: inline-block; background: #4A1D7E; color: white; padding: 10px 14px; border-radius: 10px; text-decoration: none; font-weight: 700;">
                  Reset password
                </a>
              </p>
              <p style="margin: 0; color: #6B7280; font-size: 12px;">This link expires in 1 hour.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Resend password reset email failed", emailErr);
        console.warn(
          "Password reset email not configured or failed. Reset link:",
          resetLink,
        );
      }
    } else {
      console.warn(
        "RESEND_API_KEY not set. Password reset email not configured. Reset link:",
        resetLink,
      );
    }

    // For development, return a link so you can test without email configured.
    const includeDevLink = process.env.NODE_ENV !== "production";
    const devResetLink = includeDevLink ? resetLink : undefined;

    return Response.json({ ok: true, devResetLink }, { status: 200 });
  } catch (err) {
    console.error("POST /api/password-reset/request error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
