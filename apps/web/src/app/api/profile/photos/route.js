import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

// Allowed storage domains — photos must come from our own upload pipeline.
// raw.createusercontent.com is the Anything platform CDN; adjust if you migrate storage.
const ALLOWED_PHOTO_HOSTS = new Set([
  "raw.createusercontent.com",
]);

function cleanUrl(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return null;
    }
    if (!ALLOWED_PHOTO_HOSTS.has(parsed.hostname)) {
      return null;
    }
  } catch {
    return null;
  }
  return trimmed;
}

function clampInt(value, { min, max, fallback }) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) {
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

    const rows = await sql(
      `
      SELECT id, url, sort_order, created_at
      FROM profile_photos
      WHERE user_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [userId],
    );

    const photos = (rows || []).map((r) => ({
      id: r.id,
      url: r.url,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));

    return Response.json({ ok: true, photos }, { status: 200 });
  } catch (err) {
    console.error("GET /api/profile/photos error", err);
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
    const url = cleanUrl(body?.url);
    const sortOrder = clampInt(body?.sortOrder, {
      min: 0,
      max: 4,
      fallback: 0,
    });

    if (!url) {
      return Response.json({ error: "url must be a valid https URL from an allowed storage domain" }, { status: 400 });
    }

    const countRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM profile_photos
      WHERE user_id = $1
      `,
      [userId],
    );

    const count = countRows?.[0]?.count || 0;
    if (count >= 5) {
      return Response.json({ error: "Max 5 photos" }, { status: 400 });
    }

    const rows = await sql(
      `
      INSERT INTO profile_photos (user_id, url, sort_order)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [userId, url, sortOrder],
    );

    return Response.json(
      { ok: true, id: rows?.[0]?.id || null },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/profile/photos error", err);
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

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "photo_upload",
      windowSeconds: 3600,
      limit: 20,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many uploads. Try again later." },
        { status: 429 },
      );
    }

        const body = await request.json().catch(() => null);
    const photoId = clampInt(body?.id, {
      min: 1,
      max: 999999999,
      fallback: null,
    });

    if (!photoId) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    await sql(
      `
      DELETE FROM profile_photos
      WHERE id = $1 AND user_id = $2
      `,
      [photoId, userId],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/profile/photos error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
