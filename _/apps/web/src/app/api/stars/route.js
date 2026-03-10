import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import {
  blockPairNotExistsClause,
  isBlockedPair,
} from "@/app/api/utils/blocks";

function cleanAction(value) {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (s === "add" || s === "remove") {
    return s;
  }
  return null;
}

function cleanTargetUserId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!n || Number.isNaN(n)) {
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

    const { userId } = gate;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "s.target_user_id",
    });

    const rows = await sql(
      `
      SELECT
        s.target_user_id,
        p.display_name,
        p.bio,
        p.city,
        p.state,
        p.avatar_url,
        au."emailVerified" AS email_verified,
        COALESCE(
          (
            SELECT json_agg(ui.interest ORDER BY ui.interest)
            FROM user_interests ui
            WHERE ui.user_id = s.target_user_id
          ),
          '[]'::json
        ) AS interests,
        s.created_at
      FROM user_stars s
      JOIN user_profiles p ON p.user_id = s.target_user_id
      JOIN auth_users au ON au.id = s.target_user_id
      WHERE s.user_id = $1
        AND p.onboarding_completed_at IS NOT NULL
        AND ${blocksClause}
      ORDER BY s.created_at DESC
      LIMIT 200
      `,
      [userId],
    );

    const users = (rows || []).map((r) => {
      let interestsArr = [];
      if (Array.isArray(r.interests)) {
        interestsArr = r.interests;
      } else if (typeof r.interests === "string") {
        try {
          const parsed = JSON.parse(r.interests);
          interestsArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          interestsArr = [];
        }
      }

      return {
        id: r.target_user_id,
        displayName: r.display_name || "",
        bio: r.bio || "",
        city: r.city || "",
        state: r.state || "",
        avatarUrl: r.avatar_url || "",
        isVerified: !!r.email_verified,
        interests: interestsArr,
        isStarred: true,
        starredAt: r.created_at,
      };
    });

    return Response.json({ ok: true, users }, { status: 200 });
  } catch (err) {
    console.error("GET /api/stars error", err);
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

    const body = await request.json().catch(() => ({}));

    const action = cleanAction(body?.action);
    const targetUserId = cleanTargetUserId(body?.targetUserId);

    if (!action) {
      return Response.json(
        { error: "action must be add or remove" },
        { status: 400 },
      );
    }

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    if (targetUserId === userId) {
      return Response.json(
        { error: "You cannot star yourself" },
        { status: 400 },
      );
    }

    const blocked = await isBlockedPair(sql, userId, targetUserId);
    if (blocked) {
      return Response.json({ error: "Not allowed" }, { status: 403 });
    }

    if (action === "add") {
      await sql(
        "INSERT INTO user_stars (user_id, target_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [userId, targetUserId],
      );
      return Response.json({ ok: true, isStarred: true }, { status: 200 });
    }

    await sql(
      "DELETE FROM user_stars WHERE user_id = $1 AND target_user_id = $2",
      [userId, targetUserId],
    );

    return Response.json({ ok: true, isStarred: false }, { status: 200 });
  } catch (err) {
    console.error("POST /api/stars error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
