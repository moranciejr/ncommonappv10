import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import {
  buildVerifyNudge,
  requireVerifiedOnboardedUser,
} from "@/app/api/utils/require-verified-email";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";
import { notifyNearbyPlanStartingSoon } from "@/app/api/utils/nearby-plan-notify";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import {
  moderateFields,
  logModerationEvent,
} from "@/app/api/utils/content-moderation";

function cleanText(value, { maxLen, allowEmpty }) {
  if (typeof value !== "string") {
    return allowEmpty ? "" : null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return allowEmpty ? "" : null;
  }
  const safe = trimmed.replace(/[\u0000-\u001F\u007F]/g, "");
  if (safe.length > maxLen) {
    return safe.slice(0, maxLen);
  }
  return safe;
}

function clampInt(value, min, max, fallback) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!n || Number.isNaN(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

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
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "c.user_id",
    });

    const rows = await sql(
      `
      SELECT
        c.id,
        c.user_id,
        c.location_name,
        c.note,
        c.lat,
        c.lng,
        c.starts_at,
        c.expires_at,
        c.created_at,
        c.interest,
        c.place_id,
        c.place_address,
        c.desired_group_size,
        c.desired_gender,
        p.display_name,
        p.avatar_url,
        p.is_minor,
        au."emailVerified" AS email_verified,

        -- NEW: request state machine fields for CTA
        mr.id AS my_request_id,
        mr.status AS my_request_status,

        CASE
          WHEN c.user_id = $1 THEN COALESCE(pr.pending_count, 0)
          ELSE 0
        END AS pending_request_count,

        conv.id AS my_conversation_id
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      JOIN auth_users au ON au.id = c.user_id

      -- viewer's request (if any)
      LEFT JOIN checkin_requests mr
        ON mr.checkin_id = c.id AND mr.requester_user_id = $1

      -- pending request count (owner-only)
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS pending_count
        FROM checkin_requests r2
        WHERE r2.checkin_id = c.id AND r2.status = 'pending'
      ) pr ON true

      -- direct conversation id between viewer and host (only matters when viewer != host)
      LEFT JOIN LATERAL (
        SELECT c2.id
        FROM conversations c2
        JOIN conversation_participants p1
          ON p1.conversation_id = c2.id AND p1.user_id = $1
        JOIN conversation_participants p2
          ON p2.conversation_id = c2.id AND p2.user_id = c.user_id
        WHERE $1 <> c.user_id
          AND NOT EXISTS (
            SELECT 1
            FROM conversation_participants p3
            WHERE p3.conversation_id = c2.id
              AND p3.user_id NOT IN ($1, c.user_id)
          )
        LIMIT 1
      ) conv ON true

      WHERE c.expires_at > NOW()
        AND p.onboarding_completed_at IS NOT NULL
        AND (
          c.user_id = $1
          OR (
            ${blocksClause}
            AND ($2::boolean = false OR p.is_minor = false)
            AND ($3::boolean = false OR au."emailVerified" IS NOT NULL)
          )
        )
      ORDER BY c.created_at DESC
      LIMIT 80
      `,
      [userId, hideMinors, onlyVerified],
    );

    const checkins = (rows || []).map((r) => {
      const isMine = r.user_id === userId;
      const hasMyRequest = !!r.my_request_id;

      return {
        id: r.id,
        userId: r.user_id,
        locationName: r.location_name,
        placeId: r.place_id || null,
        placeAddress: r.place_address || "",
        note: r.note || "",
        lat: r.lat === null ? null : Number(r.lat),
        lng: r.lng === null ? null : Number(r.lng),
        startsAt: r.starts_at || null,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        interest: r.interest || "",
        desiredGroupSize:
          r.desired_group_size === null ? null : Number(r.desired_group_size),
        desiredGender: r.desired_gender || null,
        displayName: r.display_name || "",
        avatarUrl: r.avatar_url || "",
        isMinor: !!r.is_minor,
        isVerified: !!r.email_verified,
        isMine,

        // NEW: minimal fields to render the CTA state machine on cards
        myRequest: hasMyRequest
          ? {
              id: r.my_request_id,
              status: r.my_request_status,
              conversationId: r.my_conversation_id || null,
            }
          : null,
        pendingRequestCount:
          typeof r.pending_request_count === "number"
            ? r.pending_request_count
            : 0,
      };
    });

    return Response.json({ ok: true, checkins }, { status: 200 });
  } catch (err) {
    console.error("GET /api/checkins error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const gate = await requireVerifiedOnboardedUser(sql, request);
    if (gate.error) {
      if (gate.status === 403 && gate.error === "Email verification required") {
        return Response.json(
          {
            error: gate.error,
            verifyNudge: buildVerifyNudge({
              title: "Verify to post plans",
              message:
                "You can browse without verifying, but you need to verify your email before posting a plan. This helps stop bots and fake accounts.",
              reason: "email_verify_required_post_plan",
            }),
          },
          { status: 403 },
        );
      }

      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;

    // Basic abuse caps (prevents spam pins).
    const okHour = await consumeRateLimit(sql, {
      userId,
      action: "checkins_created_per_hour",
      windowSeconds: 60 * 60,
      limit: 6,
    });
    const okDay = await consumeRateLimit(sql, {
      userId,
      action: "checkins_created_per_day",
      windowSeconds: 24 * 60 * 60,
      limit: 40,
    });

    if (!okHour || !okDay) {
      return Response.json(
        { error: "You're creating plans too fast. Please try again soon." },
        { status: 429 },
      );
    }

    // Pull a display name for push copy.
    const posterRows = await sql(
      `
      SELECT display_name
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );
    const posterName = posterRows?.[0]?.display_name || "";

    const tier = await getTierForSessionEmail(session?.user?.email);

    // NEW: fetch defaults (duration / group size / gender) so the app can save user preferences
    // even if the client didn't supply them.
    const defaultsRows = await sql(
      `
      SELECT
        default_plan_expires_minutes,
        default_desired_group_size,
        default_desired_gender
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const defaultExpiresMinutes =
      typeof defaultsRows?.[0]?.default_plan_expires_minutes === "number"
        ? defaultsRows[0].default_plan_expires_minutes
        : 120;

    const defaultDesiredGroupSize =
      typeof defaultsRows?.[0]?.default_desired_group_size === "number"
        ? defaultsRows[0].default_desired_group_size
        : null;

    const defaultDesiredGender =
      typeof defaultsRows?.[0]?.default_desired_gender === "string"
        ? defaultsRows[0].default_desired_gender
        : "any";

    const maxActiveByTier = {
      free: 1,
      plus: 3,
      premium: 10,
    };

    const maxActive = maxActiveByTier[tier] || 1;

    const activeRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM checkins
      WHERE user_id = $1 AND expires_at > NOW()
      `,
      [userId],
    );

    const activeCount = activeRows?.[0]?.count || 0;

    const usage = {
      tier,
      activePlans: activeCount,
      activePlansLimit: maxActive,
    };

    // NEW: soft "near limit" nudge for paid tiers (and Free after first post)
    let nearLimitNudge = null;
    if (tier === "plus" && activeCount >= Math.max(0, maxActive - 1)) {
      nearLimitNudge = {
        title: "Almost at your active plan limit",
        message: `Plus supports up to ${maxActive} active plans. Upgrade to Premium to keep up to 10 plans live at once.`,
        primaryCta: "Upgrade",
        secondaryCta: "Not now",
        target: "/upgrade",
        reason: "active_plans_near_limit_plus",
      };
    }

    // Hard limit on concurrent active plans
    if (activeCount >= maxActive) {
      if (tier === "free") {
        return Response.json(
          {
            error: "Active plan limit reached",
            usage,
            upgradeNudge: {
              title: "Post more plans",
              message:
                "Free lets you have 1 active plan at a time. Upgrade to keep multiple plans live so more people can join you.",
              primaryCta: "Upgrade",
              secondaryCta: "Not now",
              target: "/upgrade",
              reason: "active_plans_limit_free",
            },
          },
          { status: 402 },
        );
      }

      if (tier === "plus") {
        return Response.json(
          {
            error: "Active plan limit reached",
            usage,
            upgradeNudge: {
              title: "Need more active plans?",
              message:
                "Plus supports up to 3 active plans at a time. Upgrade to Premium to keep up to 10 plans live.",
              primaryCta: "Upgrade",
              secondaryCta: "Not now",
              target: "/upgrade",
              reason: "active_plans_limit_plus",
            },
          },
          { status: 402 },
        );
      }

      return Response.json(
        {
          error: "Active plan limit reached",
          usage,
        },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);

    const locationName = cleanText(body?.locationName, {
      maxLen: 160,
      allowEmpty: false,
    });

    const placeId = cleanText(body?.placeId, { maxLen: 200, allowEmpty: true });
    const placeAddress = cleanText(body?.placeAddress, {
      maxLen: 255,
      allowEmpty: true,
    });

    const note = cleanText(body?.note, { maxLen: 280, allowEmpty: true });

    // NEW: Content moderation before saving
    const moderationResult = moderateFields(
      { locationName, note },
      ["locationName", "note"],
      { allowUrls: false, allowContactInfo: false },
    );

    if (!moderationResult.allowed) {
      // Log the moderation event
      await logModerationEvent(
        userId,
        "checkin",
        JSON.stringify({ locationName, note }),
        moderationResult.reasons.join(", "),
      );

      return Response.json(
        {
          error:
            "Your plan contains inappropriate content. Please review and try again.",
          details:
            "Content must not include profanity, contact information, or inappropriate material.",
        },
        { status: 400 },
      );
    }

    const interestRaw = cleanText(body?.interest, {
      maxLen: 64,
      allowEmpty: true,
    });
    const interest = interestRaw ? interestRaw.toLowerCase() : "";

    const desiredGroupSize = clampInt(
      body?.desiredGroupSize,
      1,
      25,
      defaultDesiredGroupSize,
    );
    const desiredGenderRaw = cleanText(body?.desiredGender, {
      maxLen: 16,
      allowEmpty: true,
    });

    const desiredGender = desiredGenderRaw
      ? desiredGenderRaw.toLowerCase()
      : defaultDesiredGender;

    const expiresInMinutes = clampInt(
      body?.expiresInMinutes,
      15,
      24 * 60,
      clampInt(defaultExpiresMinutes, 15, 24 * 60, 120),
    );

    // NEW: explicit start time (ISO string). If omitted, starts now.
    let startsAt = null;
    if (body?.startsAt) {
      const d = new Date(body.startsAt);
      if (!Number.isNaN(d.getTime())) {
        startsAt = d;
      }
    }

    const now = new Date();
    if (!startsAt) {
      startsAt = now;
    }

    // Guardrails: allow scheduling up to 24h ahead.
    const startsMs = startsAt.getTime();
    const minMs = now.getTime() - 15 * 60 * 1000; // allow small clock skew
    const maxMs = now.getTime() + 24 * 60 * 60 * 1000;

    if (startsMs < minMs) {
      return Response.json(
        { error: "Start time is in the past" },
        { status: 400 },
      );
    }

    if (startsMs > maxMs) {
      return Response.json(
        { error: "Start time must be within 24 hours" },
        { status: 400 },
      );
    }

    const lat = typeof body?.lat === "number" ? body.lat : null;
    const lng = typeof body?.lng === "number" ? body.lng : null;

    if (!locationName) {
      return Response.json(
        { error: "Location name is required" },
        { status: 400 },
      );
    }

    // IMPORTANT: expires is relative to the start time (not "now").
    const expiresAt = new Date(
      startsAt.getTime() + expiresInMinutes * 60 * 1000,
    );

    // NEW: planned push timestamp (lightweight scheduler)
    // Product choice: start − 15 mins keeps notifications actionable for quick coordination.
    const plannedNotificationAt = new Date(startsAt.getTime() - 15 * 60 * 1000);
    const minsUntilStart = Math.round(
      (startsAt.getTime() - now.getTime()) / 60000,
    );

    // If it starts soon, we still do an immediate best-effort notify on create.
    // Also mark notified_at to avoid a second send from the planned-notification processor.
    const notifyImmediately = minsUntilStart <= 60 && minsUntilStart >= -5;
    const initialNotifiedAt = notifyImmediately ? now : null;

    // For paid tiers we allow multiple active plans. For Free, we enforce max=1 via the hard limit above.
    const inserted = await sql(
      `
      INSERT INTO checkins (
        user_id,
        location_name,
        place_id,
        place_address,
        note,
        lat,
        lng,
        interest,
        desired_group_size,
        desired_gender,
        starts_at,
        expires_at,
        planned_notification_at,
        notified_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING id
      `,
      [
        userId,
        locationName,
        placeId || null,
        placeAddress,
        note,
        lat,
        lng,
        interest || null,
        desiredGroupSize,
        desiredGender || null,
        startsAt.toISOString(),
        expiresAt.toISOString(),
        plannedNotificationAt.toISOString(),
        initialNotifiedAt ? initialNotifiedAt.toISOString() : null,
      ],
    );

    const id = inserted?.[0]?.id;

    // Best-effort: notify nearby people with the same interest when a plan starts soon.
    if (notifyImmediately) {
      notifyNearbyPlanStartingSoon({
        posterUserId: userId,
        posterName,
        checkinId: id,
        interest,
        locationName,
        lat,
        lng,
        startsAt: startsAt.toISOString(),
      }).catch((err) => {
        console.error("nearby plan notify failed", err);
      });
    }

    // NEW: after the post succeeds, nudge Free users that they've hit their max (1 active plan)
    // so the next time they try to post they understand why they'd need to upgrade.
    let postSuccessNudge = null;
    if (tier === "free") {
      postSuccessNudge = {
        title: "Plan posted",
        message:
          "Free includes 1 active plan at a time. Upgrade if you want to post multiple plans at once.",
        primaryCta: "Upgrade",
        secondaryCta: "Not now",
        target: "/upgrade",
        reason: "active_plans_hit_max_after_post_free",
      };
    } else if (nearLimitNudge) {
      postSuccessNudge = nearLimitNudge;
    }

    return Response.json(
      { ok: true, id, usage, upgradeNudge: postSuccessNudge },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/checkins error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
