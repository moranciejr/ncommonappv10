import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const rows = await sql(
      `
      SELECT
        fr.id,
        fr.requester_user_id,
        fr.target_user_id,
        fr.requester_confirmed_met,
        fr.target_confirmed_met,
        fr.status,
        fr.created_at,
        CASE WHEN fr.requester_user_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
        p.display_name,
        p.avatar_url,
        p.is_minor
      FROM friend_requests fr
      JOIN user_profiles p
        ON p.user_id = CASE WHEN fr.requester_user_id = $1 THEN fr.target_user_id ELSE fr.requester_user_id END
      WHERE fr.status = 'pending'
        AND (fr.requester_user_id = $1 OR fr.target_user_id = $1)
      ORDER BY fr.created_at DESC
      LIMIT 50
      `,
      [userId],
    );

    const requests = (rows || []).map((r) => ({
      id: r.id,
      requesterUserId: r.requester_user_id,
      targetUserId: r.target_user_id,
      direction: r.direction,
      requesterConfirmedMet: r.requester_confirmed_met,
      targetConfirmedMet: r.target_confirmed_met,
      createdAt: r.created_at,
      otherUser: {
        displayName: r.display_name || "",
        avatarUrl: r.avatar_url || "",
        isMinor: !!r.is_minor,
      },
    }));

    return Response.json({ ok: true, requests }, { status: 200 });
  } catch (err) {
    console.error("GET /api/friends/requests error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
