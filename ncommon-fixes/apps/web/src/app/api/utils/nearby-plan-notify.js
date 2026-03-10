import sql from "@/app/api/utils/sql";
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

    // Batch INSERT notifications for all targets in one query.
    // RETURNING user_id tells us which users didn't already have this notification
    // (the WHERE NOT EXISTS guard deduplicates).
    const userIdsParam = targets.map(String);
    const payloadJson = JSON.stringify({
      checkinId: safeCheckinId,
      interest: safeInterest,
      locationName: safeLocation,
      startsAt: start.toISOString(),
      fromUserId: String(safePosterId),
      fromUserName: safePosterName,
    });

    let newlyNotified = [];
    try {
      const insertedRows = await sql(
        `
        INSERT INTO public.notifications (user_id, type, payload)
        SELECT
          u.user_id,
          'nearby_plan_starting_soon',
          $2::jsonb
        FROM unnest($1::int[]) AS u(user_id)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.user_id = u.user_id
            AND n.type = 'nearby_plan_starting_soon'
            AND (n.payload->>'checkinId') = $3
        )
        RETURNING user_id
        `,
        [targets, payloadJson, safeCheckinId],
      );
      newlyNotified = (insertedRows || []).map((r) => r.user_id).filter(Boolean);
    } catch (err) {
      console.error("Batch notification insert failed", err);
      return { ok: false, sent: 0, reason: "insert_failed" };
    }

    if (!newlyNotified.length) {
      return { ok: true, sent: 0, targets: targets.length, reason: "all_deduped" };
    }

    // Batch fetch all active push tokens for newly notified users in one query.
    let tokenRows = [];
    try {
      tokenRows = await sql(
        `
        SELECT user_id, token
        FROM public.push_tokens
        WHERE user_id = ANY($1::int[])
          AND disabled_at IS NULL
        ORDER BY user_id, updated_at DESC
        `,
        [newlyNotified],
      );
    } catch (err) {
      console.error("Batch token fetch failed", err);
      return { ok: true, sent: 0, reason: "token_fetch_failed" };
    }

    if (!tokenRows.length) {
      return { ok: true, sent: 0, targets: targets.length, reason: "no_tokens" };
    }

    // Build one Expo message per token, then send in one API call.
    const pushMessages = tokenRows.map((r) => ({
      to: String(r.token),
      title,
      body,
      sound: "default",
      data: {
        type: "nearby_plan_starting_soon",
        checkinId: safeCheckinId,
        interest: safeInterest,
      },
    }));

    let sent = 0;
    const badTokens = [];
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushMessages),
      });
      const expoData = await response.json().catch(() => ({}));
      const results = Array.isArray(expoData?.data) ? expoData.data : [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r?.status === "ok") {
          sent++;
        } else if (r?.status === "error") {
          const errCode = r?.details?.error || "";
          const msg = typeof r?.message === "string" ? r.message : "";
          if (
            errCode === "DeviceNotRegistered" ||
            errCode === "InvalidCredentials" ||
            msg.toLowerCase().includes("not registered")
          ) {
            if (tokenRows[i]?.token) {
              badTokens.push(String(tokenRows[i].token));
            }
          }
        }
      }
    } catch (err) {
      console.error("Expo batch push failed", err);
    }

    if (badTokens.length) {
      try {
        const placeholders = badTokens.map((_, i) => `$${i + 1}`).join(", ");
        await sql(
          `UPDATE public.push_tokens SET disabled_at = NOW(), updated_at = NOW() WHERE token IN (${placeholders})`,
          badTokens,
        );
      } catch (err) {
        console.error("Failed disabling bad tokens", err);
      }
    }

    return { ok: true, sent, targets: targets.length, notified: newlyNotified.length };
  } catch (err) {
    console.error("notifyNearbyPlanStartingSoon failed", err);
    return { ok: false, sent: 0, reason: "error" };
  }
}
