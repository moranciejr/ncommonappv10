import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function cleanInterest(raw) {
  return typeof raw === "string" && raw.trim()
    ? raw.trim().toLowerCase().slice(0, 64)
    : null;
}

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;

    const tier = await getTierForSessionEmail(session?.user?.email);

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

    const radiusKm = clampNum(url.searchParams.get("radiusKm"), {
      min: 0.5,
      max: 120,
      fallback: 10,
    });

    const selectedInterest = cleanInterest(url.searchParams.get("interest"));

    const limitByTier = {
      free: 100,
      plus: 300,
      premium: 600,
    };

    const limit = limitByTier[tier] || 100;

    // Viewer safety preferences
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

    const interestsRows = await sql(
      "SELECT interest FROM user_interests WHERE user_id = $1 ORDER BY interest",
      [userId],
    );

    const myInterests = (interestsRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean)
      .slice(0, 25);

    const interestFilter = selectedInterest ? [selectedInterest] : myInterests;

    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

    // Bounding box filter (fast + cheap). Only used when a center is provided.
    const deltaLat = hasCenter ? radiusKm / 111 : null;
    const cosLat = hasCenter ? Math.cos((lat * Math.PI) / 180) : null;
    const deltaLng = hasCenter
      ? radiusKm / (111 * Math.max(0.2, cosLat))
      : null;

    const latMin = hasCenter ? lat - deltaLat : null;
    const latMax = hasCenter ? lat + deltaLat : null;
    const lngMin = hasCenter ? lng - deltaLng : null;
    const lngMax = hasCenter ? lng + deltaLng : null;

    const usage = {
      tier,
      limit,
      appliedRadiusKm: hasCenter ? radiusKm : null,
    };

    if (!interestFilter.length) {
      return Response.json(
        {
          ok: true,
          activities: [],
          myInterests,
          usage,
        },
        { status: 200 },
      );
    }

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$7",
      otherUserIdColumnSql: "af.creator_user_id",
    });

    // NOTE: this query reads from the canonical Postgres VIEW (public.activity_feed)
    // so checkins/events can’t drift apart again.
    const rows = await sql(
      `
      SELECT
        af.activity_type,
        af.activity_id,
        af.creator_user_id,
        p.display_name,
        p.avatar_url,
        p.is_minor,
        au."emailVerified" AS email_verified,
        af.title,
        af.description,
        af.lat,
        af.lng,
        af.place_id,
        af.place_address,
        af.starts_at,
        af.ends_at,
        af.expires_at,
        af.created_at,
        af.interest,
        af.visibility,
        af.max_attendees,
        c.desired_group_size,
        c.desired_gender,
        CASE
          WHEN af.activity_type = 'event' THEN (
            SELECT COUNT(*)::int
            FROM event_attendees ea
            WHERE ea.event_id = af.activity_id
          )
          ELSE NULL::int
        END AS attendee_count,
        CASE
          WHEN af.activity_type = 'event' THEN EXISTS (
            SELECT 1
            FROM event_attendees ea2
            WHERE ea2.event_id = af.activity_id
              AND ea2.user_id = $7
          )
          ELSE NULL::boolean
        END AS is_joined
      FROM public.activity_feed af
      JOIN public.user_profiles p ON p.user_id = af.creator_user_id
      JOIN public.auth_users au ON au.id = af.creator_user_id
      LEFT JOIN public.checkins c
        ON af.activity_type = 'checkin'
       AND c.id = af.activity_id
      WHERE p.onboarding_completed_at IS NOT NULL
        AND af.lat IS NOT NULL
        AND af.lng IS NOT NULL
        AND af.interest = ANY($1::text[])
        AND (
          $2::boolean = false
          OR (af.lat BETWEEN $3 AND $4 AND af.lng BETWEEN $5 AND $6)
        )
        AND (
          af.creator_user_id = $7
          OR ${blocksClause}
        )
        AND ($8::boolean = false OR p.is_minor = false)
        AND ($9::boolean = false OR au."emailVerified" IS NOT NULL)
      ORDER BY
        CASE WHEN af.activity_type = 'checkin' THEN af.created_at ELSE af.starts_at END DESC
      LIMIT $10
      `,
      [
        interestFilter,
        hasCenter,
        latMin,
        latMax,
        lngMin,
        lngMax,
        userId,
        hideMinors,
        onlyVerified,
        limit,
      ],
    );

    const activities = (rows || []).map((r) => ({
      activityType: r.activity_type,
      activityId: r.activity_id,
      creatorUserId: r.creator_user_id,
      creatorDisplayName: r.display_name || "",
      creatorAvatarUrl: r.avatar_url || "",
      isMinor: !!r.is_minor,
      isVerified: !!r.email_verified,
      title: r.title || "",
      description: r.description || "",
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      placeId: r.place_id || null,
      placeAddress: r.place_address || "",
      startsAt: r.starts_at || null,
      endsAt: r.ends_at || null,
      expiresAt: r.expires_at || null,
      createdAt: r.created_at || null,
      interest: r.interest || "",
      visibility: r.visibility || null,
      maxAttendees:
        r.max_attendees === null ? null : Number(r.max_attendees || 0),
      desiredGroupSize:
        r.desired_group_size === null ? null : Number(r.desired_group_size),
      desiredGender: r.desired_gender || null,
      attendeeCount:
        r.attendee_count === null ? null : Number(r.attendee_count || 0),
      isJoined: r.is_joined === null ? null : !!r.is_joined,
      isMine: r.creator_user_id === userId,
    }));

    return Response.json(
      {
        ok: true,
        activities,
        myInterests,
        usage,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/activity/feed error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
