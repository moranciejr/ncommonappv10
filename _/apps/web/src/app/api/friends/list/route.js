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
        f.friend_user_id,
        p.display_name,
        p.avatar_url,
        p.city,
        p.state,
        p.is_minor,
        p.show_age,
        p.date_of_birth
      FROM friendships f
      JOIN user_profiles p ON p.user_id = f.friend_user_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT 200
      `,
      [userId],
    );

    const friends = (rows || []).map((r) => ({
      userId: r.friend_user_id,
      displayName: r.display_name || "",
      avatarUrl: r.avatar_url || "",
      city: r.city || "",
      state: r.state || "",
      isMinor: !!r.is_minor,
    }));

    return Response.json({ ok: true, friends }, { status: 200 });
  } catch (err) {
    console.error("GET /api/friends/list error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
