import sql from "@/app/api/utils/sql";
import crypto from "crypto";
import { sendEmail } from "@/app/api/utils/send-email";
import { requireUser } from "@/app/api/utils/require-user";

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userId = gate?.userId;
    const email = gate?.session?.user?.email;

    if (!gate?.session || !userId || !email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If already verified, do nothing (prevents spamming resend).
    const verifiedRows = await sql`
      SELECT "emailVerified"
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const alreadyVerified = !!verifiedRows?.[0]?.emailVerified;
    if (alreadyVerified) {
      return Response.json(
        { ok: true, alreadyVerified: true, emailSent: false },
        { status: 200 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");

    await sql`
      INSERT INTO email_verification_tokens (token, user_id, expires_at)
      VALUES (${token}, ${userId}, NOW() + INTERVAL '24 hours')
    `;

    // Build a public URL that matches the current environment.
    const originFromRequest = new URL(request.url).origin;
    const baseUrl =
      process.env.AUTH_URL || process.env.APP_URL || originFromRequest;
    const verifyLink = new URL(
      `/verify-email?token=${encodeURIComponent(token)}`,
      baseUrl,
    ).toString();

    // Include dev link on Anything preview/dev environments too.
    // (On Anything, NODE_ENV can be "production" even in preview.)
    const env = process.env.ENV || process.env.NODE_ENV;
    const includeDevLink = env !== "production";
    const devVerifyLink = includeDevLink ? verifyLink : undefined;

    let emailSent = false;
    let sendFailed = false;
    let providerMessageId = null;

    if (!process.env.RESEND_API_KEY) {
      sendFailed = true;
      console.warn(
        "RESEND_API_KEY not set. Email verification not configured. Verify link:",
        verifyLink,
      );
    } else {
      try {
        const sent = await sendEmail({
          to: email,
          from: "nCommon <onboarding@resend.dev>",
          subject: "Verify your nCommon email",
          text: `Verify your email using this link: ${verifyLink}`,
          html: `
            <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
              <h2 style="margin: 0 0 12px;">Verify your email</h2>
              <p style="margin: 0 0 16px;">Click the button below to verify your email for nCommon.</p>
              <p style="margin: 0 0 16px;">
                <a href="${verifyLink}" style="display: inline-block; background: #4A1D7E; color: white; padding: 10px 14px; border-radius: 10px; text-decoration: none; font-weight: 700;">
                  Verify email
                </a>
              </p>
              <p style="margin: 0; color: #6B7280; font-size: 12px;">This link expires in 24 hours.</p>
            </div>
          `,
        });
        providerMessageId = sent?.id || null;
        emailSent = true;
      } catch (emailErr) {
        sendFailed = true;
        console.error("Resend email verification failed", emailErr);
        console.warn("Verify link:", verifyLink);
      }
    }

    // IMPORTANT: previously we always returned ok:true even if the email send failed.
    // That made the UI say "sent" even when nothing was delivered.
    // We still return 200 (to avoid breaking clients), but we expose emailSent so the UI can show a real error.
    const message = sendFailed
      ? "We couldn't send the verification email right now. If you're in development, use the dev link. If you're using Resend, make sure your sender/domain is verified and the recipient is allowed."
      : "Verification email sent.";

    return Response.json(
      {
        ok: true,
        emailSent,
        message,
        devVerifyLink,
        providerMessageId,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/email-verification/request error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
