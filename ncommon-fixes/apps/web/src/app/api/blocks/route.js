import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function parseUserId(value) {
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

    const { userId } = gate;

    const rows = await sql(
      `
      SELECT
        b.blocked_user_id,
        p.display_name,
        p.avatar_url,
        p.is_minor,
        p.show_age,
        p.date_of_birth
      FROM user_blocks b
      JOIN user_profiles p ON p.user_id = b.blocked_user_id
      WHERE b.blocker_user_id = $1
      ORDER BY b.created_at DESC
      `,
      [userId],
    );

    const blocked = (rows || []).map((r) => ({
      userId: r.blocked_user_id,
      displayName: r.display_name || "",
      avatarUrl: r.avatar_url || "",
      isMinor: !!r.is_minor,
    }));

    return Response.json({ ok: true, blocked }, { status: 200 });
  } catch (err) {
    console.error("GET /api/blocks error", err);
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

    const body = await request.json().catch(() => null);
    const targetUserId = parseUserId(body?.targetUserId);

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    if (targetUserId === userId) {
      return Response.json(
        { error: "You cannot block yourself" },
        { status: 400 },
      );
    }

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "block_user",
      windowSeconds: 3600,
      limit: 20,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many block actions. Try again later." },
        { status: 429 },
      );
    }

    await sql(
      `
      INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
      `,
      [userId, targetUserId],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/blocks error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const body = await request.json().catch(() => null);
    const targetUserId = parseUserId(body?.targetUserId);

    if (!targetUserId) {
      return Response.json(
        { error: "targetUserId is required" },
        { status: 400 },
      );
    }

    await sql(
      `
      DELETE FROM user_blocks
      WHERE blocker_user_id = $1 AND blocked_user_id = $2
      `,
      [userId, targetUserId],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/blocks error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
