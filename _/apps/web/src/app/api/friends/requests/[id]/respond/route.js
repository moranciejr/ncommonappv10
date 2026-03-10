import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const requestId = parseId(params?.id);

    if (!requestId) {
      return Response.json({ error: "Invalid request id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const confirmedMet = body?.confirmedMet === true;

    const rows = await sql(
      `
      SELECT id, requester_user_id, target_user_id, requester_confirmed_met, target_confirmed_met, status
      FROM friend_requests
      WHERE id = $1
      LIMIT 1
      `,
      [requestId],
    );

    const fr = rows?.[0];
    if (!fr) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (fr.status !== "pending") {
      return Response.json(
        { error: "Request is not pending" },
        { status: 400 },
      );
    }

    if (fr.target_user_id !== userId) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    // If either says "no", the request dies.
    if (!confirmedMet) {
      await sql(
        `
        UPDATE friend_requests
        SET status = 'declined', target_confirmed_met = false, updated_at = NOW()
        WHERE id = $1
        `,
        [requestId],
      );

      return Response.json({ ok: true, status: "declined" }, { status: 200 });
    }

    // confirmedMet === true
    // Accept only if requester also confirmed.
    const requesterConfirmed = fr.requester_confirmed_met === true;

    if (!requesterConfirmed) {
      await sql(
        `
        UPDATE friend_requests
        SET status = 'declined', target_confirmed_met = true, updated_at = NOW()
        WHERE id = $1
        `,
        [requestId],
      );

      return Response.json({ ok: true, status: "declined" }, { status: 200 });
    }

    await sql.transaction((txn) => [
      txn(
        `
        UPDATE friend_requests
        SET status = 'accepted', target_confirmed_met = true, updated_at = NOW()
        WHERE id = $1
        `,
        [requestId],
      ),
      txn(
        `
        INSERT INTO friendships (user_id, friend_user_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, friend_user_id) DO NOTHING
        `,
        [fr.requester_user_id, fr.target_user_id],
      ),
      txn(
        `
        INSERT INTO friendships (user_id, friend_user_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, friend_user_id) DO NOTHING
        `,
        [fr.target_user_id, fr.requester_user_id],
      ),
    ]);

    return Response.json({ ok: true, status: "accepted" }, { status: 200 });
  } catch (err) {
    console.error("POST /api/friends/requests/[id]/respond error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
