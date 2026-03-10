import { requireOnboardedUser } from "@/app/api/utils/require-user";

export async function requireVerifiedOnboardedUser(sqlClient, request) {
  const gate = await requireOnboardedUser(sqlClient, request);
  if (gate.error) {
    return gate;
  }

  const { userId } = gate;

  const rows = await sqlClient(
    `
    SELECT "emailVerified"
    FROM auth_users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  );

  const isVerified = !!rows?.[0]?.emailVerified;

  if (!isVerified) {
    return {
      ...gate,
      error: "Email verification required",
      status: 403,
      isVerified: false,
    };
  }

  return {
    ...gate,
    isVerified: true,
  };
}

export function buildVerifyNudge({ title, message, reason }) {
  return {
    title: title || "Verify your email",
    message:
      message ||
      "To protect the community, please verify your email before doing this.",
    primaryCta: "Verify email",
    secondaryCta: "Not now",
    target: "/verify-email",
    reason: reason || "email_verification_required",
  };
}
