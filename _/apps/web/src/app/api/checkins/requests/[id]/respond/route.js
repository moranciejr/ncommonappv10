import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { sendExpoPush } from "@/app/api/utils/push";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function cleanAction(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "accept" || v === "decline" || v === "cancel") {
    return v;
  }
  return null;
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
    const action = cleanAction(body?.action);

    if (!action) {
      return Response.json(
        { error: "action must be accept, decline, or cancel" },
        { status: 400 },
      );
    }

    // Fetch request + ownership
    const rows = await sql(
      `
      SELECT
        r.id,
        r.checkin_id,
        r.requester_user_id,
        r.status,
        c.user_id AS owner_user_id
      FROM checkin_requests r
      JOIN checkins c ON c.id = r.checkin_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [requestId],
    );

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const row = rows[0];

    // Only owner can accept/decline. Requester can cancel.
    const isOwner = row.owner_user_id === userId;
    const isRequester = row.requester_user_id === userId;

    if (action === "cancel") {
      if (!isRequester) {
        return Response.json({ error: "Not allowed" }, { status: 403 });
      }
    } else {
      if (!isOwner) {
        return Response.json({ error: "Not allowed" }, { status: 403 });
      }
    }

    const nextStatus =
      action === "accept"
        ? "accepted"
        : action === "decline"
          ? "declined"
          : "cancelled";

    const updated = await sql(
      `
      UPDATE checkin_requests
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [requestId, nextStatus],
    );

    if (!updated?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const shouldNotifyUser = async (targetUserId) => {
      const prefRows = await sql(
        `
        SELECT notif_request_updates
        FROM user_profiles
        WHERE user_id = $1
        LIMIT 1
        `,
        [targetUserId],
      );
      return prefRows?.[0]?.notif_request_updates !== false;
    };

    const pushUpdate = async ({ targetUserId, statusText }) => {
      try {
        await sendExpoPush({
          userId: targetUserId,
          type: "checkin_request_update",
          title: "Plan request update",
          body: `Your request was ${statusText}.`,
          data: {
            type: "checkin_request_update",
            checkinId: row.checkin_id,
            requestId,
            status: nextStatus,
          },
        });
      } catch (err) {
        console.error("Failed sending checkin_request_update push", err);
      }
    };

    // Notify the other side (only if enabled)
    if (action === "accept" || action === "decline") {
      const okToNotify = await shouldNotifyUser(row.requester_user_id);
      if (okToNotify) {
        await sql(
          `
          INSERT INTO notifications (user_id, type, payload)
          VALUES ($1, 'checkin_request_update', jsonb_build_object('checkinId', $2, 'requestId', $3, 'status', $4))
          `,
          [row.requester_user_id, row.checkin_id, requestId, nextStatus],
        );

        await pushUpdate({
          targetUserId: row.requester_user_id,
          statusText: nextStatus,
        });
      }
    }

    if (action === "cancel") {
      const okToNotify = await shouldNotifyUser(row.owner_user_id);
      if (okToNotify) {
        await sql(
          `
          INSERT INTO notifications (user_id, type, payload)
          VALUES ($1, 'checkin_request_update', jsonb_build_object('checkinId', $2, 'requestId', $3, 'status', $4))
          `,
          [row.owner_user_id, row.checkin_id, requestId, nextStatus],
        );

        await pushUpdate({
          targetUserId: row.owner_user_id,
          statusText: nextStatus,
        });
      }
    }

    return Response.json({ ok: true, status: nextStatus }, { status: 200 });
  } catch (err) {
    console.error("POST /api/checkins/requests/[id]/respond error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
