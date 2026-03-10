import sql from "@/app/api/utils/sql";
import sendExpoPush from "@/app/api/utils/push";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

function toDate(value) {
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function minutesDiff(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) {
    return null;
  }
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export async function notifyNearbyPlanStartingSoon({
  posterUserId,
  posterName,
  checkinId,
  interest,
  locationName,
  lat,
  lng,
  startsAt,
}) {
  try {
    const safePosterId =
      typeof posterUserId === "number"
        ? posterUserId
        : parseInt(String(posterUserId || ""), 10);

    if (!Number.isFinite(safePosterId) || safePosterId <= 0) {
      return { ok: false, sent: 0, reason: "invalid_poster" };
    }

    const safeInterest = typeof interest === "string" ? interest.trim() : "";
    if (!safeInterest) {
      return { ok: true, sent: 0, reason: "no_interest" };
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return { ok: true, sent: 0, reason: "no_coords" };
    }

    const start = toDate(startsAt);
    if (!start) {
      return { ok: true, sent: 0, reason: "no_start" };
    }

    const minsUntilStart = minutesDiff(new Date(), start);

    // Only notify for plans that start soon. (No background queue right now.)
    if (typeof minsUntilStart !== "number" || minsUntilStart > 60) {
      return { ok: true, sent: 0, reason: "not_soon" };
    }

    // If it started a while ago, don't spam.
    if (minsUntilStart < -5) {
      return { ok: true, sent: 0, reason: "already_started" };
    }

    const radiusKm = 8;
    const recencyMinutes = 30;
    const cooldownMinutes = 45;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "ul.user_id",
    });

    // Approximate "people in the area" via last-known location of users who recently opened Map/Nearest.
    // NEW: cooldown per interest per user + notification toggle gate.
    const rows = await sql(
      `
      SELECT DISTINCT ul.user_id
      FROM public.user_last_locations ul
      JOIN public.user_interests ui ON ui.user_id = ul.user_id
      JOIN public.user_profiles p ON p.user_id = ul.user_id
      LEFT JOIN public.notifications n
        ON n.user_id = ul.user_id
       AND n.type = 'nearby_plan_starting_soon'
       AND n.created_at > now() - ($7::int * interval '1 minute')
       AND (n.payload->>'interest') = $2
      WHERE ul.user_id <> $1
        AND ui.interest = $2
        AND ul.updated_at > now() - ($6::int * interval '1 minute')
        AND p.onboarding_completed_at IS NOT NULL
        AND p.appear_offline = false
        AND p.notif_nearby_plans = true
        AND n.id IS NULL
        AND ${blocksClause}
        AND (
          6371 * acos(
            cos(radians($3)) * cos(radians(ul.lat)) * cos(radians(ul.lng) - radians($4))
            + sin(radians($3)) * sin(radians(ul.lat))
          )
        ) <= $5
      ORDER BY ul.updated_at DESC
      LIMIT 40
      `,
      [
        safePosterId,
        safeInterest,
        lat,
        lng,
        radiusKm,
        recencyMinutes,
        cooldownMinutes,
      ],
    );

    const targets = (rows || [])
      .map((r) => (typeof r?.user_id === "number" ? r.user_id : null))
      .filter(Boolean);

    if (!targets.length) {
      return { ok: true, sent: 0, reason: "no_targets" };
    }

    const safePosterName =
      typeof posterName === "string" && posterName.trim()
        ? posterName.trim()
        : "Someone";

    const safeLocation =
      typeof locationName === "string" && locationName.trim()
        ? locationName.trim()
        : "a spot nearby";

    const startClock = start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    // Copy templates (interest + location first, always):
    // - Starting now (<= 5 mins):
    //   Title: "Starting now"
    //   Body:  "{interest} at {location} • starts {time} • {name}"
    // - Starts soon (6–60 mins):
    //   Title: "Starts in {mins} min"
    //   Body:  "{interest} at {location} • {time} • {name}"

    const mins = typeof minsUntilStart === "number" ? minsUntilStart : null;

    const isStartingNow = typeof mins === "number" && mins <= 5;

    const title = isStartingNow ? "Starting now" : `Starts in ${mins} min`;

    const body = isStartingNow
      ? `${safeInterest} at ${safeLocation} • starts ${startClock} • ${safePosterName}`
      : `${safeInterest} at ${safeLocation} • ${startClock} • ${safePosterName}`;

    const safeCheckinId = checkinId ? String(checkinId) : "";
    if (!safeCheckinId) {
      return { ok: true, sent: 0, reason: "no_checkin_id" };
    }

    const results = await Promise.all(
      targets.map(async (userId) => {
        try {
          // In-app notification (also acts as a cooldown marker)
          // NEW: dedupe guard so cron retries / races don't double-insert and double-push.
          const insertedRows = await sql(
            `
            INSERT INTO public.notifications (user_id, type, payload)
            SELECT
              $1,
              'nearby_plan_starting_soon',
              jsonb_build_object(
                'checkinId', $2,
                'interest', $3,
                'locationName', $4,
                'startsAt', $5,
                'fromUserId', $6,
                'fromUserName', $7
              )
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.notifications n
              WHERE n.user_id = $1
                AND n.type = 'nearby_plan_starting_soon'
                AND (n.payload->>'checkinId') = $2
            )
            RETURNING id
            `,
            [
              userId,
              safeCheckinId,
              safeInterest,
              safeLocation,
              start.toISOString(),
              String(safePosterId),
              safePosterName,
            ],
          );

          // If we didn't insert, treat as already-notified and do not send a push.
          if (!insertedRows?.length) {
            return { ok: true, sent: 0, deduped: true };
          }

          return await sendExpoPush({
            userId,
            type: "nearby_plan_starting_soon",
            title,
            body,
            data: {
              type: "nearby_plan_starting_soon",
              checkinId: safeCheckinId,
              interest: safeInterest,
            },
          });
        } catch (err) {
          console.error("Failed sending nearby plan push", err);
          return { ok: false, sent: 0 };
        }
      }),
    );

    const sent = results.reduce((sum, r) => sum + (r?.sent || 0), 0);
    return { ok: true, sent, targets: targets.length };
  } catch (err) {
    console.error("notifyNearbyPlanStartingSoon failed", err);
    return { ok: false, sent: 0, reason: "error" };
  }
}
