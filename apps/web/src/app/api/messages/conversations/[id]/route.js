import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import {
  buildVerifyNudge,
  requireVerifiedOnboardedUser,
} from "@/app/api/utils/require-verified-email";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { isBlockedPair } from "@/app/api/utils/blocks";
import { sendPushToUser } from "@/app/api/utils/push";
import {
  moderateContent,
  logModerationEvent,
} from "@/app/api/utils/content-moderation";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function cleanBody(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F]/g, "");
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
}

async function getOtherUserId(conversationId, userId) {
  const rows = await sql(
    `
    SELECT user_id
    FROM conversation_participants
    WHERE conversation_id = $1 AND user_id <> $2
    LIMIT 1
    `,
    [conversationId, userId],
  );
  return rows?.[0]?.user_id || null;
}

// NEW: fetch basic info for the other user so the mobile UI can show nCommon
// even when it wasn't passed via navigation params.
async function getOtherUserSummary(conversationId, userId) {
  const rows = await sql(
    `
    SELECT cp.user_id, p.display_name, p.is_minor, p.avatar_url
    FROM conversation_participants cp
    JOIN user_profiles p ON p.user_id = cp.user_id
    WHERE cp.conversation_id = $1
      AND cp.user_id <> $2
    LIMIT 1
    `,
    [conversationId, userId],
  );

  const r = rows?.[0] || null;
  if (!r?.user_id) {
    return null;
  }

  return {
    id: r.user_id,
    displayName: r.display_name || "",
    isMinor: !!r.is_minor,
    avatarUrl: r.avatar_url || "",
  };
}

async function otherUserAllowsMessageNotifications(otherUserId) {
  const rows = await sql(
    `
    SELECT notif_messages
    FROM user_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [otherUserId],
  );

  // Default is true
  return rows?.[0]?.notif_messages !== false;
}

export async function GET(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "send_message",
      windowSeconds: 3600,
      limit: 120,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Sending too fast. Try again later." },
        { status: 429 },
      );
    }

        const conversationId = parseId(params?.id);

    if (!conversationId) {
      return Response.json(
        { error: "Invalid conversation id" },
        { status: 400 },
      );
    }

    // Ensure membership
    const memberRows = await sql(
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [conversationId, userId],
    );

    if (!memberRows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // NEW: if either person blocked the other, treat the conversation as gone.
    const otherUserId = await getOtherUserId(conversationId, userId);
    if (!otherUserId) {
      return Response.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const blocked = await isBlockedPair(sql, userId, otherUserId);
    if (blocked) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const beforeParam = url.searchParams.get("before");
    const beforeId = parseId(beforeParam);
    const PAGE_SIZE = 50;

    const messages = await sql(
      `
      SELECT id, sender_user_id, body, created_at
      FROM messages
      WHERE conversation_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
        ${beforeId ? "AND id < $2" : ""}
      ORDER BY created_at DESC
      LIMIT ${PAGE_SIZE + 1}
      `,
      beforeId ? [conversationId, beforeId] : [conversationId],
    );

    // Use one extra row to determine if there are more pages
    const hasMore = messages.length > PAGE_SIZE;
    const page = hasMore ? messages.slice(0, PAGE_SIZE) : messages;
    // Return in ascending order for the UI
    page.reverse();

    const otherUser = await getOtherUserSummary(conversationId, userId);

    return Response.json(
      {
        ok: true,
        messages: page || [],
        hasMore,
        oldestId: page?.[0]?.id || null,
        otherUserId: otherUser?.id || null,
        otherUser,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/messages/conversations/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
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
              title: "Verify to send messages",
              message:
                "You can browse without verifying, but you need to verify your email before sending messages. This helps stop spam and scams.",
              reason: "email_verify_required_send_message",
            }),
          },
          { status: 403 },
        );
      }

      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;
    const tier = await getTierForSessionEmail(session?.user?.email);

    const conversationId = parseId(params?.id);

    if (!conversationId) {
      return Response.json(
        { error: "Invalid conversation id" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const text = cleanBody(body?.text);

    if (!text) {
      return Response.json(
        { error: "Message text is required" },
        { status: 400 },
      );
    }

    // NEW: Content moderation before saving
    const moderationResult = moderateContent(text, {
      allowUrls: false,
      allowContactInfo: false,
    });

    if (!moderationResult.allowed) {
      // Log the moderation event
      await logModerationEvent(
        userId,
        "message",
        text,
        moderationResult.reason,
      );

      return Response.json(
        {
          error:
            "Your message contains inappropriate content. Please review and try again.",
          details:
            "Messages must not include profanity, contact information, or inappropriate material.",
        },
        { status: 400 },
      );
    }

    // Ensure membership
    const memberRows = await sql(
      `
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [conversationId, userId],
    );

    if (!memberRows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const otherUserId = await getOtherUserId(conversationId, userId);
    if (!otherUserId) {
      return Response.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const blocked = await isBlockedPair(sql, userId, otherUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    // NEW: basic per-minute rate limiting (anti-spam)
    const perMinuteLimitByTier = {
      free: 12,
      plus: 30,
      premium: 60,
    };

    const perMinuteLimit = perMinuteLimitByTier[tier] ?? 12;

    const recentMsgRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM messages
      WHERE sender_user_id = $1
        AND created_at > NOW() - INTERVAL '1 minute'
      `,
      [userId],
    );

    const recentCount = recentMsgRows?.[0]?.count ?? 0;

    if (Number.isFinite(recentCount) && recentCount >= perMinuteLimit) {
      return Response.json(
        {
          error: "Rate limit exceeded",
          message: "Too many messages too fast. Try again in a moment.",
        },
        { status: 429 },
      );
    }

    // NEW: tier-based message retention
    // free: 30 days, plus: 90 days, premium: no expiry
    const retentionInterval = tier === "plus" ? "90 days" : "30 days";

    let inserted = null;
    if (tier === "premium") {
      inserted = await sql(
        `
        INSERT INTO messages (conversation_id, sender_user_id, body, expires_at)
        VALUES ($1, $2, $3, NULL)
        RETURNING id, created_at
        `,
        [conversationId, userId, text],
      );
    } else {
      inserted = await sql(
        `
        INSERT INTO messages (conversation_id, sender_user_id, body, expires_at)
        VALUES ($1, $2, $3, NOW() + ($4::interval))
        RETURNING id, created_at
        `,
        [conversationId, userId, text, retentionInterval],
      );
    }

    const message = inserted?.[0] || null;

    // NEW: in-app notification for the other user (if enabled)
    const shouldNotify = await otherUserAllowsMessageNotifications(otherUserId);
    if (shouldNotify && message?.id) {
      await sql(
        `
        INSERT INTO notifications (user_id, type, payload)
        VALUES ($1, 'message', jsonb_build_object('conversationId', $2, 'fromUserId', $3, 'messageId', $4))
        `,
        [otherUserId, conversationId, userId, message.id],
      );

      // NEW: push notification (quiet hours + toggles enforced inside sendExpoPush)
      const fromName = session?.user?.name || "New message";
      const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;

      try {
        await sendPushToUser(otherUserId, {
          title: fromName,
          body: preview,
          data: {
            type: "message",
            conversationId,
            messageId: message.id,
            fromUserId: userId,
          },
        });
      } catch (err) {
        console.error("Failed sending message push", err);
      }
    }

    return Response.json({ ok: true, message }, { status: 200 });
  } catch (err) {
    console.error("POST /api/messages/conversations/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
