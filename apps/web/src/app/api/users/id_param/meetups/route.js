import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { isBlockedPair } from "@/app/api/utils/blocks";

function toInt(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!n || Number.isNaN(n)) return null;
  return n;
}

/**
 * GET /api/users/[id]/meetups
 *
 * Returns the mutual meetup list for a profile.
 * A meetup only appears when BOTH users have confirmed it.
 * Respects blocks. Available to any authenticated viewer.
 */
export async function GET(request, { params }) {
  try {
    const targetUserId = toInt(params?.id);
    if (!targetUserId) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const { userId } = await requireUser(request);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Respect blocks.
    const blocked = await isBlockedPair(sql, userId, targetUserId);
    if (blocked) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Mutual meetups: both A→B and B→A confirmation rows exist for the same plan.
    const rows = await sql(
      `
      SELECT DISTINCT
        mc_out.confirmed_user_id   AS met_user_id,
        up.display_name,
        up.avatar_url,
        EXISTS (
          SELECT 1
          FROM public.meetup_confirmations wma_a
          JOIN public.meetup_confirmations wma_b
            ON wma_b.checkin_id          = wma_a.checkin_id
           AND wma_b.confirmer_user_id   = wma_a.confirmed_user_id
           AND wma_b.confirmed_user_id   = wma_a.confirmer_user_id
          WHERE wma_a.confirmer_user_id  = $1
            AND wma_a.confirmed_user_id  = mc_out.confirmed_user_id
            AND wma_a.would_meet_again   = TRUE
            AND wma_b.would_meet_again   = TRUE
        ) AS would_meet_again_mutual,
        MAX(mc_out.created_at) AS last_met_at
      FROM public.meetup_confirmations mc_out
      JOIN public.meetup_confirmations mc_in
        ON  mc_in.checkin_id          = mc_out.checkin_id
        AND mc_in.confirmer_user_id   = mc_out.confirmed_user_id
        AND mc_in.confirmed_user_id   = mc_out.confirmer_user_id
      JOIN public.user_profiles up
        ON up.user_id = mc_out.confirmed_user_id
      WHERE mc_out.confirmer_user_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM public.user_blocks ub
          WHERE (ub.blocker_user_id = $2 AND ub.blocked_user_id = mc_out.confirmed_user_id)
             OR (ub.blocker_user_id = mc_out.confirmed_user_id AND ub.blocked_user_id = $2)
        )
      GROUP BY mc_out.confirmed_user_id, up.display_name, up.avatar_url
      ORDER BY last_met_at DESC
      LIMIT 100
      `,
      [targetUserId, userId],
    );

    const meetups = (rows || []).map((r) => ({
      userId: r.met_user_id,
      displayName: r.display_name || "",
      avatarUrl: r.avatar_url || "",
      wouldMeetAgain: !!r.would_meet_again_mutual,
      lastMetAt: r.last_met_at || null,
    }));

    return Response.json({ ok: true, meetups, total: meetups.length }, { status: 200 });
  } catch (err) {
    console.error("GET /api/users/[id]/meetups error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
