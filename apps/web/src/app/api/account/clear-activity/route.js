import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userId = gate?.userId;

    if (!gate?.session || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "clear_activity",
      windowSeconds: 3600,
      limit: 5,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

    await sql.transaction(async (tx) => {
      await tx`
        DELETE FROM notifications
        WHERE user_id = ${userId}
      `;

      await tx`
        DELETE FROM profile_views
        WHERE viewer_user_id = ${userId} OR viewed_user_id = ${userId}
      `;

      await tx`
        DELETE FROM checkin_views
        WHERE viewer_user_id = ${userId}
           OR checkin_id IN (SELECT id FROM checkins WHERE user_id = ${userId})
      `;

      await tx`
        DELETE FROM checkin_requests
        WHERE requester_user_id = ${userId}
           OR checkin_id IN (SELECT id FROM checkins WHERE user_id = ${userId})
      `;
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/account/clear-activity error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
