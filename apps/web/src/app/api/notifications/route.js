import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}




export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;

    const withinGetLimit = await consumeRateLimit(sql, {
      userId,
      action: "notifications_get",
      windowSeconds: 60,
      limit: 30,
    });
    if (!withinGetLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

    // NEW: allow lightweight requests for badge counts without returning the full feed
    const url = new URL(request.url);
    const summaryOnly = url.searchParams.get("summary") === "1";

    const tier = await getTierForSessionEmail(session?.user?.email);

    const limitByTier = {
      free: 20,
      plus: 75,
      premium: 200,
    };
    const feedLimit = limitByTier[tier] || 20;

    const usage = {
      tier,
      notificationsLimit: feedLimit,
      notificationsTotal: null,
    };

    let upgradeNudge = null;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "b.actor_user_id",
    });

    // NEW: filter out notifications created by users in a blocked pair.
    // This prevents "blocked" users from showing up in notifications and avoids leaking activity.
    const filteredCounts = await sql(
      `
      WITH base AS (
        SELECT
          n.id,
          n.type,
          n.payload,
          n.created_at,
          n.read_at,
          CASE
            WHEN n.type = 'message' AND (n.payload->>'fromUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'fromUserId')::int
            WHEN n.type = 'checkin_view' AND (n.payload->>'viewerUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'viewerUserId')::int
            WHEN n.type = 'checkin_request' AND (n.payload->>'requesterUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'requesterUserId')::int
            WHEN n.type = 'nearby_plan_starting_soon' AND (n.payload->>'fromUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'fromUserId')::int
            ELSE NULL
          END AS actor_user_id
        FROM notifications n
        WHERE n.user_id = $1
      ),
      filtered AS (
        SELECT b.*
        FROM base b
        WHERE b.actor_user_id IS NULL
           OR ${blocksClause}
      )
      SELECT
        (SELECT COUNT(*)::int FROM filtered WHERE read_at IS NULL) AS unread_count,
        (SELECT COUNT(*)::int FROM filtered) AS total_count
      `,
      [userId],
    );

    const unreadCount = filteredCounts?.[0]?.unread_count || 0;
    const totalCount = filteredCounts?.[0]?.total_count || 0;
    usage.notificationsTotal = totalCount;

    if (tier === "free") {
      if (totalCount > feedLimit) {
        upgradeNudge = {
          title: "Keep more activity history",
          message:
            "Free keeps your latest 20 notifications. Upgrade to keep a longer history so you don’t miss views and requests.",
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "notifications_history_limit",
        };
      } else if (totalCount >= Math.max(1, feedLimit - 4)) {
        upgradeNudge = {
          title: "You’re almost at your history limit",
          message: `You have ${totalCount} of ${feedLimit} notifications stored. Upgrade to keep a longer activity history.`,
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "notifications_history_near_limit",
        };
      }
    }

    // NEW: for tab badges, we only need the counts + usage.
    // Avoid pulling the full notifications feed when the caller asks for summary.
    if (summaryOnly) {
      return Response.json(
        { ok: true, unreadCount, usage, upgradeNudge },
        { status: 200 },
      );
    }

    const rows = await sql(
      `
      WITH base AS (
        SELECT
          n.id,
          n.type,
          n.payload,
          n.created_at,
          n.read_at,
          CASE
            WHEN n.type = 'message' AND (n.payload->>'fromUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'fromUserId')::int
            WHEN n.type = 'checkin_view' AND (n.payload->>'viewerUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'viewerUserId')::int
            WHEN n.type = 'checkin_request' AND (n.payload->>'requesterUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'requesterUserId')::int
            WHEN n.type = 'nearby_plan_starting_soon' AND (n.payload->>'fromUserId') ~ '^[0-9]+$'
              THEN (n.payload->>'fromUserId')::int
            ELSE NULL
          END AS actor_user_id
        FROM notifications n
        WHERE n.user_id = $1
      ),
      filtered AS (
        SELECT b.*
        FROM base b
        WHERE b.actor_user_id IS NULL
           OR ${blocksClause}
      )
      SELECT id, type, payload, created_at, read_at
      FROM filtered
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [userId, feedLimit],
    );

    const notifications = (rows || []).map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload || {},
      createdAt: n.created_at,
      readAt: n.read_at,
      isRead: !!n.read_at,
    }));

    return Response.json(
      { ok: true, unreadCount, notifications, usage, upgradeNudge },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/notifications error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "notifications_read",
      windowSeconds: 3600,
      limit: 60,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);

    const mode = typeof body?.mode === "string" ? body.mode : "";
    const id = parseId(body?.id);

    if (mode === "all") {
      await sql(
        `
        UPDATE notifications
        SET read_at = NOW()
        WHERE user_id = $1 AND read_at IS NULL
        `,
        [userId],
      );
      return Response.json({ ok: true }, { status: 200 });
    }

    if (!id) {
      return Response.json(
        { error: "Provide { mode: 'all' } or { id }" },
        { status: 400 },
      );
    }

    const updated = await sql(
      `
      UPDATE notifications
      SET read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [id, userId],
    );

    if (!updated?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/notifications error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
