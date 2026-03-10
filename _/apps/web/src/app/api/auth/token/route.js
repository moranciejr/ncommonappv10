import { getToken } from "@auth/core/jwt";
import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const [token, jwt] = await Promise.all([
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
      raw: true,
    }),
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
    }),
  ]);

  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Include emailVerified for mobile apps (so they can gate onboarding / messaging).
  let emailVerified = null;
  try {
    const userIdRaw = jwt.sub;
    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : null;
    if (userId && !Number.isNaN(userId)) {
      const rows = await sql`
        SELECT "emailVerified"
        FROM auth_users
        WHERE id = ${userId}
        LIMIT 1
      `;
      emailVerified = rows?.[0]?.emailVerified ?? null;
    }
  } catch (err) {
    console.error("Failed to load emailVerified in /api/auth/token", err);
  }

  return new Response(
    JSON.stringify({
      jwt: token,
      user: {
        id: jwt.sub,
        email: jwt.email,
        name: jwt.name,
        emailVerified,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
