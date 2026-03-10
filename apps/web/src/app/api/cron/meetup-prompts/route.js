import sql from "@/app/api/utils/sql";
import { sendExpoPush } from "@/app/api/utils/push";

function isCronAuthorized(request) {
  try {
    const provided = request.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET || process.env.AUTH_SECRET;
    if (!provided || !expected) return false;
    return provided === expected;
  } catch {
    return false;
  }
}

/**
 * POST /api/cron/meetup-prompts
 *
 * Finds recently-expired plans with accepted attendees, claims them with
 * meetup_prompt_sent_at, then sends "Did you meet up?" pushes to all participants.
 * Run every 15 minutes via cron.
 */
export async function POST(request) {
  try {
    if (!isCronAuthorized(request)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Atomic claim: mark as prompted so concurrent cron runs don't double-send.
    const claimedRows = await sql(
      `
      UPDATE public.checkins
      SET meetup_prompt_sent_at = NOW()
      WHERE id IN (
        SELECT id FROM public.checkins
        WHERE expires_at < NOW()
          AND expires_at > NOW() - INTERVAL '2 hours'
          AND meetup_prompt_sent_at IS NULL
          AND EXISTS (
            SELECT 1 FROM public.checkin_requests cr
            WHERE cr.checkin_id = checkins.id AND cr.status = 'accepted'
          )
        ORDER BY expires_at ASC
        LIMIT 50
      )
      RETURNING id, user_id AS host_user_id, interest, location_name
      `,
      [],
    );

    const plans = Array.isArray(claimedRows) ? claimedRows : [];
    if (!plans.length) {
      return Response.json({ ok: true, plans: 0, prompted: 0 });
    }

    let prompted = 0;

    await Promise.all(
      plans.map(async (plan) => {
        try {
          const participantRows = await sql(
            `
            SELECT requester_user_id AS user_id
            FROM public.checkin_requests
            WHERE checkin_id = $1 AND status = 'accepted'
            UNION
            SELECT $2::bigint AS user_id
            `,
            [plan.id, plan.host_user_id],
          );

          const participants = (participantRows || [])
            .map((r) => r.user_id)
            .filter(Boolean);

          if (participants.length < 2) return;

          const interest = plan.interest || "your plan";
          const location = plan.location_name || "the meetup spot";

          await Promise.all(
            participants.map((userId) =>
              sendExpoPush({
                userId,
                type: "meetup_prompt",
                title: "Did you meet up? 👋",
                body: `How did ${interest} at ${location} go? Confirm your meetups.`,
                data: { type: "meetup_prompt", checkinId: String(plan.id) },
              }).catch((err) =>
                console.error(`meetup prompt push failed for user ${userId}`, err),
              ),
            ),
          );

          prompted += participants.length;
        } catch (err) {
          console.error(`meetup-prompts: failed for plan ${plan.id}`, err);
        }
      }),
    );

    return Response.json({ ok: true, plans: plans.length, prompted });
  } catch (err) {
    console.error("POST /api/cron/meetup-prompts error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
