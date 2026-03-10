import sql from "@/app/api/utils/sql";
import { notifyNearbyPlanStartingSoon } from "@/app/api/utils/nearby-plan-notify";

function clampInt(value, min, max, fallback) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

/**
 * Claims due planned notifications (by setting checkins.notified_at = now())
 * and then best-effort sends nearby-starting-soon pushes.
 *
 * This endpoint is safe to call repeatedly; claiming is done via a single UPDATE.
 */
export async function processDuePlanNotifications({ limit } = {}) {
  const safeLimit = clampInt(limit, 1, 50, 15);

  // Claim due checkins first (atomic), so concurrent callers don't double-send.
  const dueRows = await sql(
    `
    WITH due AS (
      SELECT id
      FROM public.checkins
      WHERE interest IS NOT NULL
        AND lat IS NOT NULL AND lng IS NOT NULL
        AND starts_at IS NOT NULL
        AND planned_notification_at IS NOT NULL
        AND planned_notification_at <= now()
        AND notified_at IS NULL
        AND starts_at >= now() - interval '5 minutes'
        AND starts_at <= now() + interval '60 minutes'
      ORDER BY planned_notification_at ASC
      LIMIT $1
    )
    UPDATE public.checkins c
    SET notified_at = now()
    FROM due, public.user_profiles p
    WHERE c.id = due.id
      AND p.user_id = c.user_id
    RETURNING
      c.id,
      c.user_id,
      p.display_name AS poster_name,
      c.interest,
      c.location_name,
      c.lat,
      c.lng,
      c.starts_at
    `,
    [safeLimit],
  );

  const claimed = Array.isArray(dueRows) ? dueRows : [];
  if (!claimed.length) {
    return { ok: true, claimed: 0, sent: 0 };
  }

  const results = await Promise.all(
    claimed.map(async (r) => {
      try {
        const posterUserId =
          typeof r.user_id === "number"
            ? r.user_id
            : parseInt(String(r.user_id), 10);

        const interest = r.interest ? String(r.interest) : "";
        const locationName = r.location_name ? String(r.location_name) : "";
        const lat = r.lat === null ? null : Number(r.lat);
        const lng = r.lng === null ? null : Number(r.lng);
        const startsAt = r.starts_at;

        if (
          !posterUserId ||
          !interest ||
          lat === null ||
          lng === null ||
          !startsAt
        ) {
          return { ok: true, sent: 0, skipped: true };
        }

        return await notifyNearbyPlanStartingSoon({
          posterUserId,
          posterName: r.poster_name ? String(r.poster_name) : "",
          checkinId: r.id,
          interest,
          locationName,
          lat,
          lng,
          startsAt,
        });
      } catch (err) {
        console.error(
          "processDuePlanNotifications: failed processing row",
          err,
        );
        return { ok: false, sent: 0 };
      }
    }),
  );

  const sent = results.reduce((sum, r) => sum + (r?.sent || 0), 0);
  return { ok: true, claimed: claimed.length, sent };
}
