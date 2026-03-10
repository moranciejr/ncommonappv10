import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { isBlockedPair } from "@/app/api/utils/blocks";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function parseUserId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export async function POST(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    // Rate limit: 30 friend requests per hour, 100 per day
    const okHour = await consumeRateLimit(sql, {
      userId,
      action: "friend_requests_per_hour",
      windowSeconds: 60 * 60,
      limit: 30,
    });
    const okDay = await consumeRateLimit(sql, {
      userId,
      action: "friend_requests_per_day",
      windowSeconds: 24 * 60 * 60,
      limit: 100,
    });
    if (!okHour || !okDay) {
      return Response.json(
        { error: "Too many friend requests. Please try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const targetUserId = parseUserId(body?.targetUserId);
    const requesterConfirmedMet = body?.confirmedMet === true;

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    if (targetUserId === userId) {
      return Response.json(
        { error: "You cannot friend yourself" },
        { status: 400 },
      );
    }

    // If either user has blocked the other, do not allow friend requests.
    const blocked = await isBlockedPair(sql, userId, targetUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    // If requester says they have NOT met, the request dies immediately.
    if (!requesterConfirmedMet) {
      return Response.json({ ok: true, status: "declined" }, { status: 200 });
    }

    const existing = await sql(
      `
      SELECT id, requester_user_id, target_user_id, status
      FROM friend_requests
      WHERE status = 'pending'
        AND (
          (requester_user_id = $1 AND target_user_id = $2)
          OR (requester_user_id = $2 AND target_user_id = $1)
        )
      LIMIT 1
      `,
      [userId, targetUserId],
    );

    if (existing?.length) {
      return Response.json(
        {
          error: "A pending friend request already exists",
          requestId: existing[0].id,
        },
        { status: 409 },
      );
    }

    const rows = await sql(
      `
      INSERT INTO friend_requests (requester_user_id, target_user_id, requester_confirmed_met)
      VALUES ($1, $2, true)
      RETURNING id
      `,
      [userId, targetUserId],
    );

    const requestId = rows?.[0]?.id;

    return Response.json(
      { ok: true, requestId, status: "pending" },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/friends/request error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
