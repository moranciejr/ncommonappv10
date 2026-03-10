import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

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

function parseDate(value) {
  if (typeof value !== "string") {
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function clampInt(value, { min, max, fallback }) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function normalizeInterest(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 64);
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
        e.id,
        e.creator_user_id,
        e.title,
        e.description,
        e.location_name,
        e.place_id,
        e.place_address,
        e.city,
        e.state,
        e.interest,
        e.visibility,
        e.max_attendees,
        e.lat,
        e.lng,
        e.starts_at,
        e.ends_at,
        e.created_at,
        (SELECT COUNT(*)::int FROM event_attendees ea WHERE ea.event_id = e.id) AS attendee_count,
        EXISTS (
          SELECT 1 FROM event_attendees ea2
          WHERE ea2.event_id = e.id AND ea2.user_id = $1
        ) AS is_joined
      FROM events e
      WHERE e.starts_at >= NOW() - INTERVAL '1 day'
      ORDER BY e.starts_at ASC
      LIMIT 50
      `,
      [userId],
    );

    const events = (rows || []).map((r) => ({
      id: r.id,
      creatorUserId: r.creator_user_id,
      title: r.title,
      description: r.description || "",
      locationName: r.location_name || "",
      placeId: r.place_id || null,
      placeAddress: r.place_address || "",
      city: r.city || "",
      state: r.state || "",
      interest: r.interest || "",
      visibility: r.visibility || "public",
      maxAttendees:
        typeof r.max_attendees === "number"
          ? r.max_attendees
          : r.max_attendees
            ? Number(r.max_attendees)
            : null,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      attendeeCount: r.attendee_count || 0,
      isJoined: !!r.is_joined,
    }));

    return Response.json({ ok: true, events }, { status: 200 });
  } catch (err) {
    console.error("GET /api/events error", err);
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

    // Rate limit: 5 events per hour, 20 per day
    const withinHourLimit = await consumeRateLimit(sql, {
      userId,
      action: "create_event",
      windowSeconds: 3600,
      limit: 5,
    });
    if (!withinHourLimit) {
      return Response.json(
        { error: "Too many events created recently. Try again later." },
        { status: 429 },
      );
    }

    const withinDayLimit = await consumeRateLimit(sql, {
      userId,
      action: "create_event_daily",
      windowSeconds: 86400,
      limit: 20,
    });
    if (!withinDayLimit) {
      return Response.json(
        { error: "Daily event creation limit reached." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => null);

    const title = cleanText(body?.title, { maxLen: 120, allowEmpty: false });
    const description = cleanText(body?.description, {
      maxLen: 1000,
      allowEmpty: true,
    });
    const locationName = cleanText(body?.locationName, {
      maxLen: 160,
      allowEmpty: true,
    });

    const placeId = cleanText(body?.placeId, { maxLen: 200, allowEmpty: true });
    const placeAddress = cleanText(body?.placeAddress, {
      maxLen: 255,
      allowEmpty: true,
    });

    const city = cleanText(body?.city, { maxLen: 120, allowEmpty: true });
    const state = cleanText(body?.state, { maxLen: 120, allowEmpty: true });

    const interest = normalizeInterest(body?.interest);

    const lat = clampNum(body?.lat, {
      min: -90,
      max: 90,
      fallback: null,
    });
    const lng = clampNum(body?.lng, {
      min: -180,
      max: 180,
      fallback: null,
    });

    const startsAt = parseDate(body?.startsAt);
    const endsAt = parseDate(body?.endsAt);

    const rawVisibility =
      typeof body?.visibility === "string"
        ? body.visibility.trim().toLowerCase()
        : "public";
    const visibility = rawVisibility === "private" ? "private" : "public";

    const maxAttendees = clampInt(body?.maxAttendees, {
      min: 1,
      max: 500,
      fallback: null,
    });

    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    if (!interest) {
      return Response.json({ error: "Interest is required" }, { status: 400 });
    }

    if (!startsAt) {
      return Response.json(
        { error: "Start time is required" },
        { status: 400 },
      );
    }

    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      return Response.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }

    const [created] = await sql.transaction((txn) => [
      txn`
        INSERT INTO events (
          creator_user_id,
          title,
          description,
          location_name,
          place_id,
          place_address,
          city,
          state,
          interest,
          visibility,
          max_attendees,
          lat,
          lng,
          starts_at,
          ends_at
        )
        VALUES (
          ${userId},
          ${title},
          ${description},
          ${locationName},
          ${placeId || null},
          ${placeAddress},
          ${city},
          ${state},
          ${interest},
          ${visibility},
          ${maxAttendees},
          ${lat},
          ${lng},
          ${startsAt.toISOString()},
          ${endsAt ? endsAt.toISOString() : null}
        )
        RETURNING id
      `,
      txn`
        INSERT INTO event_attendees (event_id, user_id)
        VALUES (currval(pg_get_serial_sequence('public.events','id')), ${userId})
        ON CONFLICT (event_id, user_id) DO NOTHING
      `,
    ]);

    const eventId = created?.[0]?.id;

    return Response.json({ ok: true, eventId }, { status: 200 });
  } catch (err) {
    console.error("POST /api/events error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
