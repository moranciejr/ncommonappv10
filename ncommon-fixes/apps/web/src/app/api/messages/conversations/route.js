import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import {
  buildVerifyNudge,
  requireVerifiedOnboardedUser,
} from "@/app/api/utils/require-verified-email";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import {
  blockPairNotExistsClause,
  isBlockedPair,
} from "@/app/api/utils/blocks";

function parseUserId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
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

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "p_other.user_id",
    });

    const rows = await sql(
      `
      SELECT
        c.id AS conversation_id,
        (
          SELECT m.body
          FROM messages m
          WHERE m.conversation_id = c.id
            AND (m.expires_at IS NULL OR m.expires_at > NOW())
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT m.created_at
          FROM messages m
          WHERE m.conversation_id = c.id
            AND (m.expires_at IS NULL OR m.expires_at > NOW())
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message_at,
        p_other.user_id AS other_user_id,
        up.display_name AS other_display_name,
        up.avatar_url AS other_avatar_url,
        up.is_minor AS other_is_minor
      FROM conversations c
      JOIN conversation_participants p_me
        ON p_me.conversation_id = c.id AND p_me.user_id = $1
      JOIN conversation_participants p_other
        ON p_other.conversation_id = c.id AND p_other.user_id <> $1
      JOIN user_profiles up
        ON up.user_id = p_other.user_id
      WHERE ${blocksClause}
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
      LIMIT 50
      `,
      [userId],
    );

    const conversations = (rows || []).map((r) => ({
      id: r.conversation_id,
      lastMessage: r.last_message || "",
      lastMessageAt: r.last_message_at || null,
      otherUser: {
        userId: r.other_user_id,
        displayName: r.other_display_name || "",
        avatarUrl: r.other_avatar_url || "",
        isMinor: !!r.other_is_minor,
      },
    }));

    return Response.json({ ok: true, conversations }, { status: 200 });
  } catch (err) {
    console.error("GET /api/messages/conversations error", err);
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
              title: "Verify to start chats",
              message:
                "You can browse without verifying, but you need to verify your email before messaging people. This helps prevent spam and fake accounts.",
              reason: "email_verify_required_start_chat",
            }),
          },
          { status: 403 },
        );
      }

      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;
    const tier = await getTierForSessionEmail(session?.user?.email);

    const body = await request.json().catch(() => null);
    const targetUserId = parseUserId(body?.targetUserId);

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    if (targetUserId === userId) {
      return Response.json({ error: "Invalid target" }, { status: 400 });
    }

    const blocked = await isBlockedPair(sql, userId, targetUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    const existingId = await findDirectConversationId(userId, targetUserId);
    if (existingId) {
      return Response.json(
        { ok: true, conversationId: existingId },
        { status: 200 },
      );
    }

    // NEW: basic rate limiting on new conversations (anti-spam)
    const conversationLimitByTier = {
      free: 12,
      plus: 60,
      premium: 200,
    };

    const dailyLimit = conversationLimitByTier[tier] ?? 12;

    const recentCountRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = $1
        AND c.created_at > NOW() - INTERVAL '24 hours'
      `,
      [userId],
    );

    const recentCount = recentCountRows?.[0]?.count ?? 0;

    if (Number.isFinite(recentCount) && recentCount >= dailyLimit) {
      return Response.json(
        {
          error: "Rate limit exceeded",
          message:
            "Too many new chats created in the last 24 hours. Try again later.",
        },
        { status: 429 },
      );
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
        [id, userId, targetUserId],
      );

      return id;
    });

    return Response.json({ ok: true, conversationId }, { status: 200 });
  } catch (err) {
    console.error("POST /api/messages/conversations error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
