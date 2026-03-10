import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

function cleanText(value, maxLen) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase().slice(0, maxLen);
}

function computeAgeFromDateOnly(dateOnly) {
  if (!dateOnly) {
    return null;
  }
  const s = String(dateOnly);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
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

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const url = new URL(request.url);
    const interest = cleanText(url.searchParams.get("interest"), 64);
    const search = cleanText(url.searchParams.get("search"), 80);

    // NEW: viewer discovery/safety preferences
    const viewerPrefRows = await sql(
      `
      SELECT hide_minors, only_verified, strict_mutual_interests
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const viewerPrefs = viewerPrefRows?.[0] || {};
    const hideMinors = viewerPrefs.hide_minors === true;
    const onlyVerified = viewerPrefs.only_verified === true;
    const strictMutual = viewerPrefs.strict_mutual_interests === true;

    const myInterestRows = await sql(
      "SELECT interest FROM user_interests WHERE user_id = $1 ORDER BY interest",
      [userId],
    );

    const myInterests = (myInterestRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean)
      .slice(0, 25);

    // If the user has no interests yet, just fall back to newest onboarded users.
    const useOverlap = myInterests.length > 0;

    // Strict mode only makes sense if we actually have interests to match.
    const strictOverlap = strictMutual && useOverlap;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "u.id",
    });

    const rows = await sql(
      `
      SELECT
        u.id,
        p.display_name,
        p.bio,
        p.city,
        p.state,
        p.avatar_url,
        p.is_minor,
        p.show_age,
        p.date_of_birth,
        p.appear_offline,
        u."emailVerified" AS email_verified,
        COALESCE(
          (
            SELECT json_agg(ui.interest ORDER BY ui.interest)
            FROM user_interests ui
            WHERE ui.user_id = u.id
          ),
          '[]'::json
        ) AS interests,
        EXISTS (
          SELECT 1 FROM user_stars s
          WHERE s.user_id = $1 AND s.target_user_id = u.id
        ) AS is_starred,
        (
          SELECT COUNT(*)::int
          FROM user_interests ui_match
          WHERE ui_match.user_id = u.id
            AND ($4::text[] IS NOT NULL)
            AND ui_match.interest = ANY($4::text[])
        ) AS overlap_count,
        -- Active checkin (most recent non-expired one)
        ac.checkin_id,
        ac.checkin_interest,
        ac.checkin_location,
        ac.checkin_starts_at,
        ac.checkin_expires_at,
        ac.checkin_note
      FROM auth_users u
      JOIN user_profiles p ON p.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          c.id        AS checkin_id,
          c.interest  AS checkin_interest,
          c.location_name AS checkin_location,
          c.starts_at AS checkin_starts_at,
          c.expires_at AS checkin_expires_at,
          c.note      AS checkin_note
        FROM checkins c
        WHERE c.user_id = u.id
          AND c.expires_at > NOW()
        ORDER BY c.created_at DESC
        LIMIT 1
      ) ac ON true
      WHERE p.onboarding_completed_at IS NOT NULL
        AND u.id <> $1
        AND p.appear_offline = false
        AND ${blocksClause}
        AND ($2::text IS NULL OR EXISTS (
          SELECT 1 FROM user_interests ui2
          WHERE ui2.user_id = u.id AND ui2.interest = $2
        ))
        AND (
          $3::text IS NULL
          OR LOWER(p.display_name) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.bio, '')) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.city, '')) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.state, '')) LIKE '%' || $3 || '%'
        )
        -- NEW: Safety filters
        AND ($6::boolean = false OR p.is_minor = false)
        AND ($7::boolean = false OR u."emailVerified" IS NOT NULL)
        -- NEW: strict mutual interests
        AND (
          $8::boolean = false
          OR EXISTS (
            SELECT 1
            FROM user_interests ui_strict
            WHERE ui_strict.user_id = u.id
              AND ($4::text[] IS NOT NULL)
              AND ui_strict.interest = ANY($4::text[])
          )
        )
      ORDER BY
        -- Active users (have a live checkin) always float to the top
        CASE WHEN ac.checkin_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        -- Then by interest overlap
        CASE WHEN $5::boolean THEN overlap_count ELSE 0 END DESC,
        p.onboarding_completed_at DESC
      LIMIT 50
      `,
      [
        userId,
        interest,
        search,
        useOverlap ? myInterests : null,
        useOverlap,
        hideMinors,
        onlyVerified,
        strictOverlap,
      ],
    );

    const users = (rows || []).map((r) => {
      let interestsArr = [];
      if (Array.isArray(r.interests)) {
        interestsArr = r.interests;
      } else if (typeof r.interests === "string") {
        try {
          const parsed = JSON.parse(r.interests);
          interestsArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          interestsArr = [];
        }
      }

      const showAge = !!r.show_age;
      const age = showAge ? computeAgeFromDateOnly(r.date_of_birth) : null;

      const hasCheckin = !!r.checkin_id;

      return {
        id: r.id,
        displayName: r.display_name || "",
        bio: r.bio || "",
        city: r.city || "",
        state: r.state || "",
        avatarUrl: r.avatar_url || "",
        isVerified: !!r.email_verified,
        interests: interestsArr,
        overlapCount:
          typeof r.overlap_count === "number"
            ? r.overlap_count
            : Number(r.overlap_count || 0),
        isStarred: !!r.is_starred,
        isMinor: !!r.is_minor,
        showAge,
        age,
        // Active check-in (null if user has no live plan)
        checkin: hasCheckin
          ? {
              id: r.checkin_id,
              interest: r.checkin_interest || null,
              locationName: r.checkin_location || null,
              startsAt: r.checkin_starts_at || null,
              expiresAt: r.checkin_expires_at || null,
              note: r.checkin_note || null,
            }
          : null,
      };
    });

    return Response.json({ ok: true, users, myInterests }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/ncommon error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
