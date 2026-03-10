import sql from "@/app/api/utils/sql";
import {
  buildVerifyNudge,
  requireVerifiedOnboardedUser,
} from "@/app/api/utils/require-verified-email";
import { isBlockedPair } from "@/app/api/utils/blocks";
import { sendExpoPush } from "@/app/api/utils/push";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

async function canMeetAdultMinorPair(userA, userB) {
  const rows = await sql(
    `
    SELECT
      (SELECT is_minor FROM user_profiles WHERE user_id = $1 LIMIT 1) AS a_is_minor,
      (SELECT is_minor FROM user_profiles WHERE user_id = $2 LIMIT 1) AS b_is_minor
    `,
    [userA, userB],
  );

  const aMinor = rows?.[0]?.a_is_minor === true;
  const bMinor = rows?.[0]?.b_is_minor === true;

  if (aMinor === bMinor) {
    return true;
  }

  // Friends are allowed.
  const friendRows = await sql(
    `
    SELECT 1
    FROM friendships
    WHERE (user_id = $1 AND friend_user_id = $2)
       OR (user_id = $2 AND friend_user_id = $1)
    LIMIT 1
    `,
    [userA, userB],
  );
  if (friendRows?.length) {
    return true;
  }

  // Shared event attendance is allowed.
  const sharedEventRows = await sql(
    `
    SELECT 1
    FROM event_attendees ea1
    JOIN event_attendees ea2 ON ea2.event_id = ea1.event_id
    JOIN events e ON e.id = ea1.event_id
    WHERE ea1.user_id = $1
      AND ea2.user_id = $2
      AND e.starts_at >= NOW() - INTERVAL '14 days'
      AND e.starts_at <= NOW() + INTERVAL '30 days'
    LIMIT 1
    `,
    [userA, userB],
  );

  return !!sharedEventRows?.length;
}

async function findDirectConversationId(userA, userB) {
  const rows = await sql(
    `
    SELECT c.id
    FROM conversations c
    JOIN conversation_participants p1
      ON p1.conversation_id = c.id AND p1.user_id = $1
    JOIN conversation_participants p2
      ON p2.conversation_id = c.id AND p2.user_id = $2
    WHERE NOT EXISTS (
      SELECT 1
      FROM conversation_participants p3
      WHERE p3.conversation_id = c.id
        AND p3.user_id NOT IN ($1, $2)
    )
    LIMIT 1
    `,
    [userA, userB],
  );
  return rows?.[0]?.id || null;
}

async function getOrCreateDirectConversationId(userA, userB) {
  const existing = await findDirectConversationId(userA, userB);
  if (existing) {
    return existing;
  }

  const conversationId = await sql.transaction(async (txn) => {
    const created = await txn(
      `
      INSERT INTO conversations DEFAULT VALUES
      RETURNING id
      `,
      [],
    );

    const id = created?.[0]?.id;

    await txn(
      `
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES ($1, $2), ($1, $3)
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      `,
      [id, userA, userB],
    );

    return id;
  });

  return conversationId;
}

export async function POST(request, { params }) {
  try {
    const gate = await requireVerifiedOnboardedUser(sql, request);
    if (gate.error) {
      if (gate.status === 403 && gate.error === "Email verification required") {
        return Response.json(
          {
            error: gate.error,
            verifyNudge: buildVerifyNudge({
              title: "Verify to request plans",
              message:
                "You can browse plans without verifying, but you need to verify your email before requesting to join. This helps keep nCommon safe.",
              reason: "email_verify_required_request_plan",
            }),
          },
          { status: 403 },
        );
      }

      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const checkinId = parseId(params?.id);

    if (!checkinId) {
      return Response.json({ error: "Invalid check-in id" }, { status: 400 });
    }

    // Basic abuse caps (prevents request spam).
    const okMinute = await consumeRateLimit(sql, {
      userId,
      action: "checkin_requests_per_minute",
      windowSeconds: 60,
      limit: 3,
    });
    const okDay = await consumeRateLimit(sql, {
      userId,
      action: "checkin_requests_per_day",
      windowSeconds: 24 * 60 * 60,
      limit: 40,
    });

    if (!okMinute || !okDay) {
      return Response.json(
        { error: "Too many requests. Please slow down and try again." },
        { status: 429 },
      );
    }

    // Get owner, ensure active
    const rows = await sql(
      `
      SELECT c.user_id
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      WHERE c.id = $1
        AND c.expires_at > NOW()
        AND p.onboarding_completed_at IS NOT NULL
      LIMIT 1
      `,
      [checkinId],
    );

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const ownerUserId = rows[0].user_id;

    if (ownerUserId === userId) {
      return Response.json(
        { error: "You cannot request your own post" },
        { status: 400 },
      );
    }

    const blocked = await isBlockedPair(sql, userId, ownerUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    const allowed = await canMeetAdultMinorPair(userId, ownerUserId);
    if (!allowed) {
      return Response.json(
        {
          error:
            "Invites are restricted until you share an event or are friends",
        },
        { status: 403 },
      );
    }

    const inserted = await sql(
      `
      INSERT INTO checkin_requests (checkin_id, requester_user_id)
      VALUES ($1, $2)
      ON CONFLICT (checkin_id, requester_user_id)
      DO UPDATE SET updated_at = NOW()
      RETURNING id, status
      `,
      [checkinId, userId],
    );

    const requestId = inserted?.[0]?.id;
    const status = inserted?.[0]?.status || "pending";

    // NEW: create (or reuse) a direct chat between requester and host.
    // This enables the "request to join" flow to always include a conversation.
    const conversationId = await getOrCreateDirectConversationId(
      userId,
      ownerUserId,
    );

    // Notify owner (only if enabled in Settings)
    const ownerPrefRows = await sql(
      `
      SELECT notif_join_requests
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [ownerUserId],
    );

    const ownerAllows = ownerPrefRows?.[0]?.notif_join_requests !== false;

    if (ownerAllows) {
      await sql(
        `
        INSERT INTO notifications (user_id, type, payload)
        VALUES (
          $1,
          'checkin_request',
          jsonb_build_object(
            'checkinId', $2,
            'requesterUserId', $3,
            'requestId', $4,
            'conversationId', $5
          )
        )
        `,
        [ownerUserId, checkinId, userId, requestId, conversationId],
      );

      // NEW: push (quiet hours enforced inside sendExpoPush)
      try {
        await sendExpoPush({
          userId: ownerUserId,
          type: "checkin_request",
          title: "New join request",
          body: "Someone wants to join your plan.",
          data: {
            type: "checkin_request",
            checkinId,
            requesterUserId: userId,
            requestId,
            conversationId,
          },
        });
      } catch (err) {
        console.error("Failed sending checkin_request push", err);
      }
    }

    return Response.json(
      { ok: true, requestId, status, conversationId },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/checkins/[id]/request error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
