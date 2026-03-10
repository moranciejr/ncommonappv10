import { auth } from "@/auth";
import { getToken } from "@auth/core/jwt";

function parseUserId(raw) {
  if (!raw) {
    return null;
  }
  const userId = typeof raw === "string" ? parseInt(raw, 10) : raw;
  if (!userId || Number.isNaN(userId)) {
    return null;
  }
  return userId;
}

async function readJwtFromRequest(request) {
  if (!request) {
    return null;
  }
  try {
    const authUrl =
      typeof process.env.AUTH_URL === "string" ? process.env.AUTH_URL : "";
    const jwt = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: authUrl.startsWith("https"),
    });
    return jwt || null;
  } catch (err) {
    console.error("Failed to read JWT from request", err);
    return null;
  }
}

export async function requireUser(request) {
  // 1) Prefer Bearer token (mobile standalone builds)
  const jwt = await readJwtFromRequest(request);
  if (jwt?.sub) {
    const userId = parseUserId(jwt.sub);
    if (userId) {
      return {
        session: {
          user: {
            id: jwt.sub,
            name: jwt.name,
            email: jwt.email,
          },
        },
        userId,
      };
    }
  }

  // 2) Fallback to cookie-based session (web)
  const session = await auth();
  const userId = parseUserId(session?.user?.id);
  if (!session || !userId) {
    return { session: null, userId: null };
  }
  return { session, userId };
}

function toIsoDateOnly(value) {
  if (!value) {
    return "";
  }
  // pg DATE might arrive as string ("YYYY-MM-DD") or a Date instance
  if (typeof value === "string") {
    const trimmed = value.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? trimmed : "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return "";
}

function computeAgeFromIsoDateOnly(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) {
    return null;
  }
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth() + 1;
  const da = now.getUTCDate();

  let age = y - year;
  if (mo < month || (mo === month && da < day)) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 130) {
    return null;
  }
  return age;
}

export async function requireOnboardedUser(sqlClient, request) {
  const { session, userId } = await requireUser(request);
  if (!session || !userId) {
    return { session: null, userId: null, error: "Unauthorized", status: 401 };
  }

  const rows = await sqlClient`
    SELECT onboarding_completed_at, date_of_birth, is_minor
    FROM user_profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  const completedAt = rows?.[0]?.onboarding_completed_at;
  const dobRaw = rows?.[0]?.date_of_birth;
  const isMinor = !!rows?.[0]?.is_minor;

  const dob = toIsoDateOnly(dobRaw);

  // Onboarding is only considered complete once DOB is collected.
  if (!completedAt || !dob) {
    return {
      session,
      userId,
      error: "Onboarding required",
      status: 403,
    };
  }

  // Hard enforce adult-only (18+).
  if (isMinor) {
    return {
      session,
      userId,
      error: "You must be 18+ to use nCommon",
      status: 403,
    };
  }

  const age = computeAgeFromIsoDateOnly(dob);
  if (age !== null && age < 18) {
    // Best-effort: cache the restriction in the DB so future gates are cheap.
    try {
      await sqlClient`
        UPDATE user_profiles
        SET is_minor = true, updated_at = NOW()
        WHERE user_id = ${userId}
          AND (is_minor IS NULL OR is_minor = false)
      `;
    } catch (err) {
      console.error("Failed to mark user as minor", err);
    }

    return {
      session,
      userId,
      error: "You must be 18+ to use nCommon",
      status: 403,
    };
  }

  return { session, userId, error: null, status: 200 };
}
