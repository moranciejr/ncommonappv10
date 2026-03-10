import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import {
  moderateFields,
  logModerationEvent,
} from "@/app/api/utils/content-moderation";

const MAX_INTERESTS = 10;

function cleanText(value, { maxLen, allowEmpty }) {
  if (typeof value !== "string") {
    return allowEmpty ? "" : null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return allowEmpty ? "" : null;
  }
  // remove control chars
  const safe = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  if (safe.length > maxLen) {
    return safe.slice(0, maxLen);
  }
  return safe;
}

function normalizeInterest(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const noControls = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  const collapsed = noControls.replace(/\s+/g, " ");

  // allowlist characters (letters, numbers, space, basic punctuation)
  const ok = /^[a-z0-9 '\-&,/.()]+$/.test(collapsed);
  if (!ok) {
    return null;
  }

  if (collapsed.length > 64) {
    return collapsed.slice(0, 64);
  }

  return collapsed;
}

function parseISODateOnly(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  if (!year || !month || !day) {
    return null;
  }

  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  // reject impossible dates like 02/31
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  // date-only string for Postgres DATE
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function computeAgeFromISODateOnly(isoDate) {
  const d = parseISODateOnly(isoDate);
  if (!d) {
    return null;
  }
  const [yStr, mStr, dStr] = d.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);

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

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userIdRaw = gate?.userId;

    if (!gate?.session || !userIdRaw) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : userIdRaw;

    if (!userId || Number.isNaN(userId)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const displayName = cleanText(body?.displayName, {
      maxLen: 80,
      allowEmpty: false,
    });
    const bio = cleanText(body?.bio, { maxLen: 500, allowEmpty: true });
    const city = cleanText(body?.city, { maxLen: 120, allowEmpty: true });
    const state = cleanText(body?.state, { maxLen: 120, allowEmpty: true });
    const avatarUrl = cleanText(body?.avatarUrl, {
      maxLen: 2000,
      allowEmpty: true,
    });

    // NEW: Content moderation before saving
    const moderationResult = moderateFields(
      { displayName, bio },
      ["displayName", "bio"],
      { allowUrls: false, allowContactInfo: false },
    );

    if (!moderationResult.allowed) {
      // Log the moderation event
      await logModerationEvent(
        userId,
        "profile",
        JSON.stringify({ displayName, bio }),
        moderationResult.reasons.join(", "),
      );

      return Response.json(
        {
          error:
            "Your profile contains inappropriate content. Please review and try again.",
          details:
            "Profile information must not include profanity, contact information, or inappropriate material.",
        },
        { status: 400 },
      );
    }

    // {{ add }} DOB is required but private by default
    const dateOfBirth = parseISODateOnly(body?.dateOfBirth);
    const showAge = !!body?.showAge;

    if (!displayName) {
      return Response.json(
        { error: "Display name is required" },
        { status: 400 },
      );
    }

    if (!dateOfBirth) {
      return Response.json(
        { error: "Date of birth is required" },
        { status: 400 },
      );
    }

    const age = computeAgeFromISODateOnly(dateOfBirth);
    if (age === null) {
      return Response.json(
        { error: "Date of birth is invalid" },
        { status: 400 },
      );
    }

    // enforce 18+ without "adult-only" wording in code comments
    if (age < 18) {
      return Response.json(
        { error: "You must be 18+ to use nCommon" },
        { status: 400 },
      );
    }

    const isMinor = false;

    // verify email is verified before allowing onboarding completion
    const userRows = await sql`
      SELECT "emailVerified"
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const emailVerified = userRows?.[0]?.emailVerified;
    if (!emailVerified) {
      return Response.json(
        { error: "Email must be verified before onboarding" },
        { status: 403 },
      );
    }

    const rawInterests = Array.isArray(body?.interests) ? body.interests : [];

    const normalized = rawInterests.map(normalizeInterest).filter(Boolean);

    const unique = Array.from(new Set(normalized)).slice(0, MAX_INTERESTS);

    if (!unique.length) {
      return Response.json(
        { error: "Please pick at least 1 interest" },
        { status: 400 },
      );
    }

    const queries = [
      sql`
        INSERT INTO user_profiles (
          user_id,
          display_name,
          bio,
          city,
          state,
          avatar_url,
          date_of_birth,
          is_minor,
          show_age,
          onboarding_completed_at,
          updated_at
        )
        VALUES (
          ${userId},
          ${displayName},
          ${bio},
          ${city},
          ${state},
          ${avatarUrl},
          ${dateOfBirth},
          ${isMinor},
          ${showAge},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          avatar_url = EXCLUDED.avatar_url,
          date_of_birth = EXCLUDED.date_of_birth,
          is_minor = EXCLUDED.is_minor,
          show_age = EXCLUDED.show_age,
          onboarding_completed_at = COALESCE(user_profiles.onboarding_completed_at, EXCLUDED.onboarding_completed_at),
          updated_at = NOW()
      `,
      sql`DELETE FROM user_interests WHERE user_id = ${userId}`,
      ...unique.map(
        (interest) =>
          sql`
            INSERT INTO user_interests (user_id, interest)
            VALUES (${userId}, ${interest})
            ON CONFLICT (user_id, interest) DO NOTHING
          `,
      ),
    ];

    await sql.transaction(queries);

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/onboarding/complete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
