import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";
import { processDuePlanNotifications } from "@/app/api/utils/process-due-plan-notifications";

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

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

    // Fire-and-forget: opportunistically process any due nearby-plan notifications.
    processDuePlanNotifications({ limit: 5 }).catch((err) => {
      console.error("processDuePlanNotifications (users/nearby) failed", err);
    });

    const url = new URL(request.url);

    const lat = clampNum(url.searchParams.get("lat"), {
      min: -90,
      max: 90,
      fallback: null,
    });
    const lng = clampNum(url.searchParams.get("lng"), {
      min: -180,
      max: 180,
      fallback: null,
    });

    if (typeof lat !== "number" || typeof lng !== "number") {
      return Response.json(
        { error: "lat and lng are required" },
        { status: 400 },
      );
    }

    // NEW: save last-known viewer location so we can notify people "in the area".
    try {
      await sql(
        `
        INSERT INTO public.user_last_locations (user_id, lat, lng, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, updated_at = NOW()
        `,
        [userId, lat, lng],
      );
    } catch (err) {
      // best-effort only
      console.error("Failed saving last location", err);
    }

    const interest = cleanText(url.searchParams.get("interest"), 64);

    // NEW: viewer discovery/safety preferences
    const viewerPrefRows = await sql(
      `
      SELECT hide_minors, only_verified
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const viewerPrefs = viewerPrefRows?.[0] || {};
    const hideMinors = viewerPrefs.hide_minors === true;
    const onlyVerified = viewerPrefs.only_verified === true;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$3",
      otherUserIdColumnSql: "c.user_id",
    });

    // Approx distance (km) using acos. Fine for an MVP without PostGIS.
    const rows = await sql(
      `
      SELECT
        c.id AS checkin_id,
        c.user_id,
        c.location_name,
        c.note,
        c.lat,
        c.lng,
        c.interest,
        c.starts_at,
        c.created_at,
        c.expires_at,
        p.display_name,
        p.bio,
        p.city,
        p.state,
        p.avatar_url,
        p.is_minor,
        p.show_age,
        p.date_of_birth,
        p.hide_distance,
        p.appear_offline,
        u."emailVerified" AS email_verified,
        EXISTS (
          SELECT 1 FROM user_stars s
          WHERE s.user_id = $3 AND s.target_user_id = c.user_id
        ) AS is_starred,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians($2))
            + sin(radians($1)) * sin(radians(c.lat))
          )
        ) AS distance_km
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      JOIN auth_users u ON u.id = c.user_id
      WHERE c.expires_at > NOW()
        AND c.lat IS NOT NULL
        AND c.lng IS NOT NULL
        AND c.user_id <> $3
        AND p.onboarding_completed_at IS NOT NULL
        AND p.appear_offline = false
        AND ${blocksClause}
        AND ($4::text IS NULL OR c.interest = $4)
        -- NEW: Safety filters
        AND ($5::boolean = false OR p.is_minor = false)
        AND ($6::boolean = false OR u."emailVerified" IS NOT NULL)
      ORDER BY distance_km ASC
      LIMIT 50
      `,
      [lat, lng, userId, interest, hideMinors, onlyVerified],
    );

    const users = (rows || []).map((r) => {
      const hideDistance = !!r.hide_distance;

      const distKmRaw =
        typeof r.distance_km === "number"
          ? r.distance_km
          : Number(r.distance_km || NaN);

      const distKm =
        !hideDistance && Number.isFinite(distKmRaw) ? distKmRaw : null;
      const distMi = distKm === null ? null : distKm * 0.621371;

      const showAge = !!r.show_age;
      const age = showAge ? computeAgeFromDateOnly(r.date_of_birth) : null;

      return {
        id: r.user_id,
        displayName: r.display_name || "",
        bio: r.bio || "",
        city: r.city || "",
        state: r.state || "",
        avatarUrl: r.avatar_url || "",
        isVerified: !!r.email_verified,
        isStarred: !!r.is_starred,
        isMinor: !!r.is_minor,
        showAge,
        age,
        hideDistance,
        distanceKm: distKm,
        distanceMiles: distMi,
        checkin: {
          id: r.checkin_id,
          locationName: r.location_name || "",
          note: r.note || "",
          interest: r.interest || "",
          lat: r.lat === null ? null : Number(r.lat),
          lng: r.lng === null ? null : Number(r.lng),
          startsAt: r.starts_at || null,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
        },
      };
    });

    return Response.json({ ok: true, users }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/nearby error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
