import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { isBlockedPair } from "@/app/api/utils/blocks";
import { sendExpoPush } from "@/app/api/utils/push";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * POST /api/checkins/[id]/confirm-meetup
 *
 * Body: { confirmedUserId: number, wouldMeetAgain: boolean }
 *
 * Records that the caller met `confirmedUserId` on this plan.
 * If the other person has already confirmed back, they become a mutual meetup
 * and both appear on each other's "People I've met" list.
 * If wouldMeetAgain is true and the other person also flagged it, the
 * "Would meet again" count increments on both profiles.
 */
export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const checkinId = parseId(params?.id);
    if (!checkinId) {
      return Response.json({ error: "Invalid checkin id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const confirmedUserId = parseId(body?.confirmedUserId);
    const wouldMeetAgain = body?.wouldMeetAgain === true;

    if (!confirmedUserId) {
      return Response.json(
        { error: "confirmedUserId is required" },
        { status: 400 },
      );
    }

    if (confirmedUserId === userId) {
      return Response.json(
        { error: "You cannot confirm a meetup with yourself" },
        { status: 400 },
      );
    }

    // Rate limit: 30 confirmations per hour (covers edge cases / testing)
    const ok = await consumeRateLimit(sql, {
      userId,
      action: "meetup_confirm",
      windowSeconds: 3600,
      limit: 30,
    });
    if (!ok) {
      return Response.json(
        { error: "Too many requests. Slow down." },
        { status: 429 },
      );
    }

    // Verify the plan exists and that BOTH users were accepted attendees
    // (host is always an attendee of their own plan).
    const planRows = await sql(
      `
      SELECT c.id, c.user_id AS host_user_id, c.expires_at, c.interest, c.location_name
      FROM checkins c
      WHERE c.id = $1
      LIMIT 1
      `,
      [checkinId],
    );

    if (!planRows?.length) {
      return Response.json({ error: "Plan not found" }, { status: 404 });
    }

    const plan = planRows[0];
    const hostUserId = plan.host_user_id;

    // Check caller was a participant (host or accepted requester)
    const callerIsHost = userId === hostUserId;
    const targetIsHost = confirmedUserId === hostUserId;

    if (!callerIsHost) {
      const callerRows = await sql(
        `SELECT 1 FROM checkin_requests
         WHERE checkin_id = $1 AND requester_user_id = $2 AND status = 'accepted'
         LIMIT 1`,
        [checkinId, userId],
      );
      if (!callerRows?.length) {
        return Response.json(
          { error: "You were not a participant in this plan" },
          { status: 403 },
        );
      }
    }

    if (!targetIsHost) {
      const targetRows = await sql(
        `SELECT 1 FROM checkin_requests
         WHERE checkin_id = $1 AND requester_user_id = $2 AND status = 'accepted'
         LIMIT 1`,
        [checkinId, confirmedUserId],
      );
      if (!targetRows?.length) {
        return Response.json(
          { error: "That person was not a participant in this plan" },
          { status: 403 },
        );
      }
    }

    // Respect blocks in either direction.
    const blocked = await isBlockedPair(sql, userId, confirmedUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    // Upsert the caller's confirmation (allows updating wouldMeetAgain).
    await sql(
      `
      INSERT INTO public.meetup_confirmations
        (checkin_id, confirmer_user_id, confirmed_user_id, would_meet_again, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (checkin_id, confirmer_user_id, confirmed_user_id)
      DO UPDATE SET
        would_meet_again = EXCLUDED.would_meet_again,
        updated_at = NOW()
      `,
      [checkinId, userId, confirmedUserId, wouldMeetAgain],
    );

    // Check if the other person has already confirmed back → mutual meetup.
    const mutualRows = await sql(
      `SELECT would_meet_again FROM public.meetup_confirmations
       WHERE checkin_id = $1
         AND confirmer_user_id = $2
         AND confirmed_user_id = $3
       LIMIT 1`,
      [checkinId, confirmedUserId, userId],
    );

    const isMutual = !!mutualRows?.length;
    const otherWouldMeetAgain = mutualRows?.[0]?.would_meet_again === true;
    const mutualWouldMeetAgain = isMutual && wouldMeetAgain && otherWouldMeetAgain;

    // If newly mutual, notify the other person.
    if (isMutual) {
      try {
        const callerNameRows = await sql(
          `SELECT display_name FROM user_profiles WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        const callerName =
          callerNameRows?.[0]?.display_name?.trim() || "Someone";

        await sendExpoPush({
          userId: confirmedUserId,
          type: "meetup_confirmed",
          title: "Meetup confirmed! 🤝",
          body: `You and ${callerName} are now on each other's meetup list.`,
          data: {
            type: "meetup_confirmed",
            checkinId: String(checkinId),
            fromUserId: String(userId),
          },
        });

        // In-app notification
        await sql(
          `INSERT INTO notifications (user_id, type, payload)
           VALUES ($1, 'meetup_confirmed', jsonb_build_object(
             'checkinId', $2,
             'fromUserId', $3,
             'wouldMeetAgain', $4
           ))
           ON CONFLICT DO NOTHING`,
          [confirmedUserId, String(checkinId), String(userId), mutualWouldMeetAgain],
        );
      } catch (err) {
        console.error("Failed sending meetup_confirmed push", err);
      }
    } else {
      // Nudge the other person to confirm — they haven't yet.
      try {
        const callerNameRows = await sql(
          `SELECT display_name FROM user_profiles WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        const callerName =
          callerNameRows?.[0]?.display_name?.trim() || "Someone";

        await sendExpoPush({
          userId: confirmedUserId,
          type: "meetup_nudge",
          title: "Did you meet up?",
          body: `${callerName} says you met! Confirm to appear on each other's profiles.`,
          data: {
            type: "meetup_nudge",
            checkinId: String(checkinId),
            fromUserId: String(userId),
          },
        });
      } catch (err) {
        console.error("Failed sending meetup_nudge push", err);
      }
    }

    return Response.json(
      {
        ok: true,
        isMutual,
        wouldMeetAgain,
        mutualWouldMeetAgain,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/checkins/[id]/confirm-meetup error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
