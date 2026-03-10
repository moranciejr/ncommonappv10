import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";
import { processDuePlanNotifications } from "@/app/api/utils/process-due-plan-notifications";

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;

    // Fire-and-forget: opportunistically process any due nearby-plan notifications.
    // (MVP “cron” driven by real traffic; safe due to checkins.notified_at claiming.)
    processDuePlanNotifications({ limit: 5 }).catch((err) => {
      console.error("processDuePlanNotifications (map/points) failed", err);
    });

    const tier = await getTierForSessionEmail(session?.user?.email);
    const maxRadiusKmByTier = {
      free: 5,
      plus: 40,
      premium: 120,
    };
    const maxRadiusKm = maxRadiusKmByTier[tier] || 5;

    // NEW: per-tier result caps (prevents free-tier “data firehose”)
    const resultCapsByTier = {
      free: { checkins: 80, events: 20, hotspots: 60 },
      plus: { checkins: 200, events: 120, hotspots: 80 },
      premium: { checkins: 260, events: 160, hotspots: 100 },
    };
    const caps = resultCapsByTier[tier] || resultCapsByTier.free;

    const url = new URL(request.url);

    // NEW: optional distance units for UI strings
    const unitsRaw = url.searchParams.get("units");
    const units = unitsRaw === "km" ? "km" : "mi";

    const lat = clampNum(url.searchParams.get("lat"), {
      min: -90,
      max: 90,
      fallback: 30.2672, // Austin fallback
    });

    const lng = clampNum(url.searchParams.get("lng"), {
      min: -180,
      max: 180,
      fallback: -97.7431,
    });

    // NEW: save last-known viewer location so we can notify people "in the area".
    // (best-effort only)
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
      console.error("Failed saving last location", err);
    }

    const requestedRadiusKm = clampNum(url.searchParams.get("radiusKm"), {
      min: 0.5,
      max: 120,
      fallback: 7,
    });

    const radiusKm = Math.min(requestedRadiusKm, maxRadiusKm);

    const usage = {
      tier,
      requestedRadiusKm,
      appliedRadiusKm: radiusKm,
      maxRadiusKm,
    };

    let upgradeNudge = null;
    if (tier === "free" && requestedRadiusKm > maxRadiusKm) {
      if (units === "km") {
        const roundedKm = Math.round(maxRadiusKm);
        upgradeNudge = {
          title: "Expand your map radius",
          message: `Free lets you browse about ${roundedKm} km from the map center. Upgrade to explore farther and find more plans.`,
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "map_range_limit",
        };
      } else {
        const maxMiles = Math.round(maxRadiusKm * 0.621371);
        upgradeNudge = {
          title: "Expand your map radius",
          message: `Free lets you browse about ${maxMiles} miles from the map center. Upgrade to explore farther and find more plans.`,
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "map_range_limit",
        };
      }
    }

    const selectedInterestRaw = url.searchParams.get("interest");
    const selectedInterest =
      typeof selectedInterestRaw === "string" && selectedInterestRaw.trim()
        ? selectedInterestRaw.trim().toLowerCase().slice(0, 64)
        : null;

    const interestsRows = await sql(
      "SELECT interest FROM user_interests WHERE user_id = $1 ORDER BY interest",
      [userId],
    );

    const myInterests = (interestsRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean)
      .slice(0, 25);

    const interestFilter = selectedInterest ? [selectedInterest] : myInterests;

    // NEW: viewer safety preferences
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

    // Bounding box filter (fast + cheap)
    const deltaLat = radiusKm / 111;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const deltaLng = radiusKm / (111 * Math.max(0.2, cosLat));

    const latMin = lat - deltaLat;
    const latMax = lat + deltaLat;
    const lngMin = lng - deltaLng;
    const lngMax = lng + deltaLng;

    if (!interestFilter.length) {
      return Response.json(
        {
          ok: true,
          myInterests,
          hotspots: [],
          users: [],
          events: [],
          usage,
          upgradeNudge,
        },
        { status: 200 },
      );
    }

    // --- Unified activity query (checkins + events) via public.activity_feed VIEW ---
    // This is the canonical source of truth for “active” checkins + “future” events.
    const blocksCheckinClause = blockPairNotExistsClause({
      viewerUserIdSql: "$6",
      otherUserIdColumnSql: "c.user_id",
    });

    const blocksEventClause = blockPairNotExistsClause({
      viewerUserIdSql: "$6",
      otherUserIdColumnSql: "e.creator_user_id",
    });

    const activityRows = await sql(
      `
      WITH checkin_items AS (
        SELECT
          'checkin'::text AS activity_type,
          af.activity_id AS id,
          c.user_id,
          c.location_name,
          c.note,
          c.lat,
          c.lng,
          c.interest,
          c.desired_group_size,
          c.desired_gender,
          c.created_at,
          c.expires_at,
          p.display_name,
          p.avatar_url,
          p.is_minor,
          au."emailVerified" AS email_verified,
          -- NEW: minimal CTA state machine fields
          mr.id AS my_request_id,
          mr.status AS my_request_status,
          CASE
            WHEN c.user_id = $6 THEN COALESCE(pr.pending_count, 0)
            ELSE 0
          END AS pending_request_count,
          conv.id AS my_conversation_id,
          COALESCE(
            (
              SELECT COUNT(*)::int
              FROM public.user_interests ui_match
              WHERE ui_match.user_id = c.user_id
                AND ($9::text[] IS NOT NULL)
                AND ui_match.interest = ANY($9::text[])
            ),
            0
          ) AS overlap_count,
          NULL::int AS creator_user_id,
          NULL::text AS title,
          NULL::text AS city,
          NULL::text AS state,
          c.starts_at AS starts_at,
          NULL::timestamptz AS ends_at,
          NULL::int AS attendee_count,
          NULL::boolean AS is_joined
        FROM public.activity_feed af
        JOIN public.checkins c ON c.id = af.activity_id
        JOIN public.user_profiles p ON p.user_id = c.user_id
        JOIN public.auth_users au ON au.id = c.user_id
        -- viewer's request (if any)
        LEFT JOIN public.checkin_requests mr
          ON mr.checkin_id = c.id AND mr.requester_user_id = $6
        -- pending request count (owner-only)
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS pending_count
          FROM public.checkin_requests r2
          WHERE r2.checkin_id = c.id AND r2.status = 'pending'
        ) pr ON true
        -- direct conversation id between viewer and host (optional shortcut for accepted CTA)
        LEFT JOIN LATERAL (
          SELECT c2.id
          FROM public.conversations c2
          JOIN public.conversation_participants p1
            ON p1.conversation_id = c2.id AND p1.user_id = $6
          JOIN public.conversation_participants p2
            ON p2.conversation_id = c2.id AND p2.user_id = c.user_id
          WHERE $6 <> c.user_id
            AND NOT EXISTS (
              SELECT 1
              FROM public.conversation_participants p3
              WHERE p3.conversation_id = c2.id
                AND p3.user_id NOT IN ($6, c.user_id)
            )
          LIMIT 1
        ) conv ON true
        WHERE af.activity_type = 'checkin'
          AND p.onboarding_completed_at IS NOT NULL
          AND af.lat IS NOT NULL
          AND af.lng IS NOT NULL
          AND af.interest IS NOT NULL
          AND af.interest = ANY($1::text[])
          AND af.lat BETWEEN $2 AND $3
          AND af.lng BETWEEN $4 AND $5
          AND (
            c.user_id = $6
            OR ${blocksCheckinClause}
          )
          AND ($7::boolean = false OR p.is_minor = false)
          AND ($8::boolean = false OR au."emailVerified" IS NOT NULL)
        ORDER BY c.created_at DESC
        LIMIT $10
      ),
      event_items AS (
        SELECT
          'event'::text AS activity_type,
          af.activity_id AS id,
          NULL::int AS user_id,
          e.location_name,
          NULL::text AS note,
          e.lat,
          e.lng,
          e.interest,
          NULL::int AS desired_group_size,
          NULL::text AS desired_gender,
          e.created_at,
          NULL::timestamptz AS expires_at,
          NULL::text AS display_name,
          NULL::text AS avatar_url,
          ep.is_minor,
          au."emailVerified" AS email_verified,
          -- NEW: CTA state machine fields (not used for events)
          NULL::bigint AS my_request_id,
          NULL::text AS my_request_status,
          NULL::int AS pending_request_count,
          NULL::bigint AS my_conversation_id,
          NULL::int AS overlap_count,
          e.creator_user_id,
          e.title,
          e.city,
          e.state,
          e.starts_at,
          e.ends_at,
          (SELECT COUNT(*)::int FROM public.event_attendees ea WHERE ea.event_id = e.id) AS attendee_count,
          EXISTS (
            SELECT 1 FROM public.event_attendees ea2
            WHERE ea2.event_id = e.id AND ea2.user_id = $6
          ) AS is_joined
        FROM public.activity_feed af
        JOIN public.events e ON e.id = af.activity_id
        JOIN public.auth_users au ON au.id = e.creator_user_id
        JOIN public.user_profiles ep ON ep.user_id = e.creator_user_id
        WHERE af.activity_type = 'event'
          AND af.lat IS NOT NULL
          AND af.lng IS NOT NULL
          AND af.interest IS NOT NULL
          AND af.interest = ANY($1::text[])
          AND af.lat BETWEEN $2 AND $3
          AND af.lng BETWEEN $4 AND $5
          AND ${blocksEventClause}
          AND ($7::boolean = false OR ep.is_minor = false)
          AND ($8::boolean = false OR au."emailVerified" IS NOT NULL)
        ORDER BY e.starts_at ASC
        LIMIT $11
      )
      SELECT * FROM checkin_items
      UNION ALL
      SELECT * FROM event_items
      `,
      [
        interestFilter,
        latMin,
        latMax,
        lngMin,
        lngMax,
        userId,
        hideMinors,
        onlyVerified,
        myInterests.length ? myInterests : null,
        caps.checkins,
        caps.events,
      ],
    );

    const usersRows = (activityRows || []).filter(
      (r) => r?.activity_type === "checkin",
    );
    const eventsRows = (activityRows || []).filter(
      (r) => r?.activity_type === "event",
    );

    const blocksHotspotsClause = blockPairNotExistsClause({
      viewerUserIdSql: "$6",
      otherUserIdColumnSql: "c.user_id",
    });

    const hotspotsRows = await sql(
      `
      SELECT
        c.interest,
        c.location_name,
        AVG(c.lat) AS lat,
        AVG(c.lng) AS lng,
        COUNT(*)::int AS count,
        (
          ARRAY_AGG(p.avatar_url ORDER BY c.created_at DESC)
          FILTER (WHERE p.avatar_url IS NOT NULL AND p.avatar_url <> '')
        )[1] AS avatar_url
      FROM public.activity_feed af
      JOIN public.checkins c ON c.id = af.activity_id
      JOIN public.user_profiles p ON p.user_id = c.user_id
      JOIN public.auth_users au ON au.id = c.user_id
      WHERE af.activity_type = 'checkin'
        AND p.onboarding_completed_at IS NOT NULL
        AND af.lat IS NOT NULL
        AND af.lng IS NOT NULL
        AND af.interest IS NOT NULL
        AND af.interest = ANY($1::text[])
        AND af.lat BETWEEN $2 AND $3
        AND af.lng BETWEEN $4 AND $5
        AND (
          c.user_id = $6
          OR ${blocksHotspotsClause}
        )
        AND ($7::boolean = false OR p.is_minor = false)
        AND ($8::boolean = false OR au."emailVerified" IS NOT NULL)
      GROUP BY c.interest, c.location_name
      ORDER BY count DESC
      LIMIT $9
      `,
      [
        interestFilter,
        latMin,
        latMax,
        lngMin,
        lngMax,
        userId,
        hideMinors,
        onlyVerified,
        caps.hotspots,
      ],
    );

    const users = (usersRows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      displayName: r.display_name || "",
      avatarUrl: r.avatar_url || "",
      interest: r.interest || "",
      locationName: r.location_name || "",
      note: r.note || "",
      desiredGroupSize:
        r.desired_group_size === null ? null : Number(r.desired_group_size),
      desiredGender: r.desired_gender || null,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      startsAt: r.starts_at || null,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      isMine: r.user_id === userId,
      isMinor: !!r.is_minor,
      isVerified: !!r.email_verified,
      overlapCount:
        typeof r.overlap_count === "number"
          ? r.overlap_count
          : Number(r.overlap_count || 0),
      // NEW: minimal fields to render the single CTA on map sheet cards
      myRequest: r.my_request_id
        ? {
            id: r.my_request_id,
            status: r.my_request_status,
            conversationId: r.my_conversation_id || null,
          }
        : null,
      pendingRequestCount:
        typeof r.pending_request_count === "number"
          ? r.pending_request_count
          : Number(r.pending_request_count || 0),
    }));

    const hotspots = (hotspotsRows || []).map((r) => ({
      id: `${r.interest || ""}::${r.location_name || ""}`,
      interest: r.interest || "",
      locationName: r.location_name || "",
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      count: typeof r.count === "number" ? r.count : Number(r.count || 0),
      avatarUrl: r.avatar_url || "",
    }));

    const nowMs = Date.now();
    const events = (eventsRows || []).map((r) => {
      const startsAt = r.starts_at;
      const endsAt = r.ends_at;

      const startMs = startsAt ? new Date(startsAt).getTime() : NaN;
      const endMs = endsAt ? new Date(endsAt).getTime() : NaN;

      const isHappeningNow = Number.isFinite(startMs)
        ? startMs <= nowMs && (!Number.isFinite(endMs) || endMs >= nowMs)
        : false;

      return {
        id: r.id,
        creatorUserId: r.creator_user_id,
        title: r.title || "",
        locationName: r.location_name || "",
        city: r.city || "",
        state: r.state || "",
        interest: r.interest || "",
        lat: r.lat === null ? null : Number(r.lat),
        lng: r.lng === null ? null : Number(r.lng),
        startsAt,
        endsAt,
        attendeeCount: r.attendee_count || 0,
        isJoined: !!r.is_joined,
        isHappeningNow,
      };
    });

    return Response.json(
      {
        ok: true,
        myInterests,
        hotspots,
        users,
        events,
        usage,
        upgradeNudge,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/map/points error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
