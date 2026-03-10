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

// NEW: used to populate myRequest.conversationId for the CTA "Message host"
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

export async function GET(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;
    const checkinId = parseId(params?.id);

    if (!checkinId) {
      return Response.json({ error: "Invalid check-in id" }, { status: 400 });
    }

    // NEW: viewer safety preferences
    const viewerPrefRows = await sql(
      `
      SELECT hide_minors, only_verified
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const viewerPrefs = viewerPrefRows?.[0] || {};
    const hideMinors = viewerPrefs.hide_minors === true;
    const onlyVerified = viewerPrefs.only_verified === true;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$2",
      otherUserIdColumnSql: "c.user_id",
    });

    const rows = await sql(
      `
      SELECT
        c.id,
        c.user_id,
        c.location_name,
        c.place_id,
        c.place_address,
        c.note,
        c.lat,
        c.lng,
        c.interest,
        c.desired_group_size,
        c.desired_gender,
        c.starts_at,
        c.created_at,
        c.expires_at,
        p.display_name,
        p.avatar_url,
        p.is_minor,
        p.notif_plan_views,
        u.email,
        u."emailVerified" AS email_verified
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      JOIN auth_users u ON u.id = c.user_id
      WHERE c.id = $1
        AND c.expires_at > NOW()
        AND p.onboarding_completed_at IS NOT NULL
        AND (
          c.user_id = $2
          OR ${blocksClause}
        )
      LIMIT 1
      `,
      [checkinId, userId],
    );

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const c = rows[0];

    // ---- Map pin (plan) view limits + upgrade nudges (Free tier) ----
    const tier = await getTierForSessionEmail(session?.user?.email);
    const isMine = c.user_id === userId;

    // NEW: enforce viewer safety filters (discovery + direct opens)
    if (!isMine) {
      if (hideMinors && c.is_minor === true) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      if (onlyVerified && !c.email_verified) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
    }

    let usage = {
      tier,
      planViewsLast24h: null,
      planViewLimit: null,
    };

    let upgradeNudge = null;

    if (!isMine) {
      const limit = 10;
      const warnAt = 8;

      // "Already viewed" should be based on the last 24h window (so the daily limit works correctly)
      const viewedInWindowRows = await sql(
        `
        SELECT 1
        FROM checkin_views
        WHERE checkin_id = $1
          AND viewer_user_id = $2
          AND created_at > now() - interval '24 hours'
        LIMIT 1
        `,
        [checkinId, userId],
      );

      const alreadyViewedInWindow = !!viewedInWindowRows?.length;

      const countRows = await sql(
        `
        SELECT COUNT(DISTINCT checkin_id)::int AS count
        FROM checkin_views
        WHERE viewer_user_id = $1
          AND created_at > now() - interval '24 hours'
        `,
        [userId],
      );

      const currentCount = countRows?.[0]?.count || 0;

      usage = {
        tier,
        planViewsLast24h: currentCount,
        planViewLimit: tier === "free" ? limit : null,
      };

      // If this would be a *new* plan view inside the current 24h window, enforce the Free limit.
      if (tier === "free" && !alreadyViewedInWindow && currentCount >= limit) {
        upgradeNudge = {
          title: "Daily plan views reached",
          message:
            "You’ve hit 10 plan pins viewed in the last 24 hours. Upgrade to keep exploring plans on the map.",
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "map_pin_views_limit",
        };

        return Response.json(
          {
            error: "Daily plan view limit reached",
            usage,
            upgradeNudge,
          },
          { status: 402 },
        );
      }

      // Record a view (and "refresh" the timestamp so rolling 24h limits behave correctly).
      // Notify the owner only on the first-ever view from this viewer.
      const insertedRows = await sql(
        `
        INSERT INTO checkin_views (checkin_id, viewer_user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (checkin_id, viewer_user_id)
        DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING (xmax = 0) AS inserted
        `,
        [checkinId, userId],
      );

      const didInsertEver = !!insertedRows?.[0]?.inserted;

      if (didInsertEver) {
        // Premium feature: view alerts (notifications) are only sent for Plus/Premium owners,
        // and only if the owner has enabled them in Settings.
        const ownerTier = await getTierForSessionEmail(c.email);
        const ownerAllows = c.notif_plan_views === true;

        if (ownerTier !== "free" && ownerAllows) {
          await sql(
            `
            INSERT INTO notifications (user_id, type, payload)
            VALUES ($1, 'checkin_view', jsonb_build_object('checkinId', $2, 'viewerUserId', $3))
            `,
            [c.user_id, checkinId, userId],
          );
        }
      }

      const afterRows = await sql(
        `
        SELECT COUNT(DISTINCT checkin_id)::int AS count
        FROM checkin_views
        WHERE viewer_user_id = $1
          AND created_at > now() - interval '24 hours'
        `,
        [userId],
      );

      const afterCount = afterRows?.[0]?.count || currentCount;

      usage = {
        tier,
        planViewsLast24h: afterCount,
        planViewLimit: tier === "free" ? limit : null,
      };

      // "Near limit" nudge only when this view was newly counted in the rolling 24h window.
      if (tier === "free" && !alreadyViewedInWindow && afterCount >= warnAt) {
        upgradeNudge = {
          title: "You’re almost at your daily limit",
          message: `You’ve viewed ${afterCount} of ${limit} plan pins in the last 24 hours. Upgrade to keep exploring.`,
          primaryCta: "Upgrade",
          secondaryCta: "Keep browsing",
          target: "/upgrade",
          reason: "map_pin_views_near_limit",
        };
      }
    }

    const requestRows = await sql(
      `
      SELECT
        r.id,
        r.requester_user_id,
        r.status,
        r.created_at,
        up.display_name,
        up.avatar_url,
        up.is_minor,
        au."emailVerified" AS requester_email_verified
      FROM checkin_requests r
      JOIN user_profiles up ON up.user_id = r.requester_user_id
      JOIN auth_users au ON au.id = r.requester_user_id
      WHERE r.checkin_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
      `,
      [checkinId],
    );

    const myRequestRows = await sql(
      `
      SELECT id, status
      FROM checkin_requests
      WHERE checkin_id = $1 AND requester_user_id = $2
      LIMIT 1
      `,
      [checkinId, userId],
    );

    const myRequestBase = myRequestRows?.[0]
      ? { id: myRequestRows[0].id, status: myRequestRows[0].status }
      : null;

    const myConversationId =
      myRequestBase && !isMine
        ? await findDirectConversationId(userId, c.user_id)
        : null;

    const checkin = {
      id: c.id,
      userId: c.user_id,
      displayName: c.display_name || "",
      avatarUrl: c.avatar_url || "",
      isMinor: !!c.is_minor,
      isVerified: !!c.email_verified,
      locationName: c.location_name || "",
      placeId: c.place_id || null,
      placeAddress: c.place_address || "",
      note: c.note || "",
      interest: c.interest || "",
      desiredGroupSize:
        c.desired_group_size === null ? null : Number(c.desired_group_size),
      desiredGender: c.desired_gender || null,
      lat: c.lat === null ? null : Number(c.lat),
      lng: c.lng === null ? null : Number(c.lng),
      startsAt: c.starts_at || null,
      createdAt: c.created_at,
      expiresAt: c.expires_at,
      isMine,
      myRequest: myRequestBase
        ? { ...myRequestBase, conversationId: myConversationId }
        : null,
      requests: (requestRows || []).map((r) => ({
        id: r.id,
        requesterUserId: r.requester_user_id,
        status: r.status,
        createdAt: r.created_at,
        displayName: r.display_name || "",
        avatarUrl: r.avatar_url || "",
        isMinor: !!r.is_minor,
        isVerified: !!r.requester_email_verified,
      })),
    };

    return Response.json(
      { ok: true, checkin, usage, upgradeNudge },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/checkins/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const checkinId = parseId(params?.id);
    if (!checkinId) {
      return Response.json({ error: "Invalid check-in id" }, { status: 400 });
    }

    const withinPatchLimit = await consumeRateLimit(sql, {
      userId,
      action: "checkin_reschedule",
      windowSeconds: 3600,
      limit: 20,
    });
    if (!withinPatchLimit) {
      return Response.json(
        { error: "Too many reschedule attempts. Try again later." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);
    const startsAtRaw = body?.startsAt;
    if (!startsAtRaw) {
      return Response.json({ error: "startsAt is required" }, { status: 400 });
    }

    const newStart = new Date(startsAtRaw);
    if (Number.isNaN(newStart.getTime())) {
      return Response.json(
        { error: "startsAt must be a valid date" },
        { status: 400 },
      );
    }

    const rows = await sql(
      `
      SELECT id, user_id, starts_at, expires_at
      FROM checkins
      WHERE id = $1 AND user_id = $2
        AND expires_at > now()
      LIMIT 1
      `,
      [checkinId, userId],
    );

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const existing = rows[0];
    const oldStart = existing?.starts_at ? new Date(existing.starts_at) : null;
    const oldExpires = existing?.expires_at
      ? new Date(existing.expires_at)
      : null;

    const oldStartMs =
      oldStart && !Number.isNaN(oldStart.getTime()) ? oldStart.getTime() : null;
    const oldExpiresMs =
      oldExpires && !Number.isNaN(oldExpires.getTime())
        ? oldExpires.getTime()
        : null;

    const newStartMs = newStart.getTime();

    // Only recompute scheduling fields when starts_at changes.
    const isSameStart =
      typeof oldStartMs === "number"
        ? Math.abs(oldStartMs - newStartMs) < 1000
        : false;

    if (isSameStart) {
      return Response.json(
        {
          ok: true,
          id: checkinId,
          updated: false,
          reason: "starts_at_unchanged",
        },
        { status: 200 },
      );
    }

    // Guardrail: don't allow moving the start time too far into the past.
    const now = new Date();
    const minMs = now.getTime() - 5 * 60 * 1000;
    const maxMs = now.getTime() + 24 * 60 * 60 * 1000;

    if (newStartMs < minMs) {
      return Response.json(
        { error: "Start time is too far in the past" },
        { status: 400 },
      );
    }

    if (newStartMs > maxMs) {
      return Response.json(
        { error: "Start time must be within 24 hours" },
        { status: 400 },
      );
    }

    // Preserve the existing duration (expires_at - starts_at) when rescheduling.
    let durationMinutes = 120;
    if (typeof oldStartMs === "number" && typeof oldExpiresMs === "number") {
      const diffMinutes = Math.round((oldExpiresMs - oldStartMs) / 60000);
      if (Number.isFinite(diffMinutes)) {
        durationMinutes = Math.max(15, Math.min(24 * 60, diffMinutes));
      }
    }

    const newExpires = new Date(newStartMs + durationMinutes * 60 * 1000);
    const plannedNotificationAt = new Date(newStartMs - 15 * 60 * 1000);

    const updatedRows = await sql(
      `
      UPDATE checkins
      SET
        starts_at = $1,
        expires_at = $2,
        planned_notification_at = $3,
        notified_at = NULL
      WHERE id = $4 AND user_id = $5
        AND expires_at > now()
      RETURNING id, starts_at, expires_at, planned_notification_at, notified_at
      `,
      [
        newStart.toISOString(),
        newExpires.toISOString(),
        plannedNotificationAt.toISOString(),
        checkinId,
        userId,
      ],
    );

    if (!updatedRows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(
      {
        ok: true,
        id: updatedRows[0].id,
        startsAt: updatedRows[0].starts_at,
        expiresAt: updatedRows[0].expires_at,
        plannedNotificationAt: updatedRows[0].planned_notification_at,
        notifiedAt: updatedRows[0].notified_at,
        updated: true,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("PATCH /api/checkins/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const withinDeleteLimit = await consumeRateLimit(sql, {
      userId,
      action: "checkin_delete",
      windowSeconds: 3600,
      limit: 30,
    });
    if (!withinDeleteLimit) {
      return Response.json(
        { error: "Too many delete attempts. Try again later." },
        { status: 429 },
      );
    }
    const rawId = params?.id;
    const checkinId = rawId ? parseInt(rawId, 10) : NaN;

    if (!checkinId || Number.isNaN(checkinId)) {
      return Response.json({ error: "Invalid check-in id" }, { status: 400 });
    }

    // Only allow the owner to end their check-in.
    const rows = await sql`
      UPDATE checkins
      SET expires_at = NOW()
      WHERE id = ${checkinId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/checkins/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
