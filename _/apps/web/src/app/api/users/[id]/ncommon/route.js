import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { isBlockedPair } from "@/app/api/utils/blocks";

function toInt(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!n || Number.isNaN(n)) {
    return null;
  }
  return n;
}

export async function GET(request, { params }) {
  try {
    const targetUserId = toInt(params?.id);
    if (!targetUserId) {
      return Response.json({ error: "Invalid user id" }, { status: 400 });
    }

    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    if (userId === targetUserId) {
      return Response.json(
        { ok: true, overlapCount: 0, overlapInterests: [] },
        { status: 200 },
      );
    }

    // Respect blocks in either direction.
    const blocked = await isBlockedPair(sql, userId, targetUserId);
    if (blocked) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // NOTE: Keep this lightweight. We only need the overlap list + count.
    const overlapRows = await sql(
      `
      SELECT ui.interest
      FROM user_interests ui
      WHERE ui.user_id = $1
        AND ui.interest = ANY(
          SELECT ui2.interest
          FROM user_interests ui2
          WHERE ui2.user_id = $2
        )
      ORDER BY ui.interest ASC
      LIMIT 12
      `,
      [userId, targetUserId],
    );

    const overlapInterests = (overlapRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean);

    // We only return up to 12 interests, so compute the count via SQL (accurate).
    const countRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM user_interests ui
      WHERE ui.user_id = $1
        AND ui.interest = ANY(
          SELECT ui2.interest
          FROM user_interests ui2
          WHERE ui2.user_id = $2
        )
      `,
      [userId, targetUserId],
    );

    const overlapCount = countRows?.[0]?.count || 0;

    return Response.json(
      {
        ok: true,
        overlapCount,
        overlapInterests,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/users/[id]/ncommon error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
