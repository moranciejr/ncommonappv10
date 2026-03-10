import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "event_join",
      windowSeconds: 3600,
      limit: 30,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many actions. Try again later." },
        { status: 429 },
      );
    }

        const rawId = params?.id;
    const eventId = rawId ? parseInt(rawId, 10) : NaN;

    if (!eventId || Number.isNaN(eventId)) {
      return Response.json({ error: "Invalid event id" }, { status: 400 });
    }

    // Enforce capacity limit if the event has one set
    const eventRows = await sql`
      SELECT max_attendees
      FROM events
      WHERE id = ${eventId}
        AND (ends_at IS NULL OR ends_at > NOW())
      LIMIT 1
    `;

    if (!eventRows?.length) {
      return Response.json({ error: "Event not found or has ended" }, { status: 404 });
    }

    const maxAttendees = eventRows[0].max_attendees;

    if (maxAttendees !== null) {
      const countRows = await sql`
        SELECT COUNT(*)::int AS count
        FROM event_attendees
        WHERE event_id = ${eventId}
      `;
      const current = countRows?.[0]?.count ?? 0;
      if (current >= maxAttendees) {
        return Response.json({ error: "This event is full" }, { status: 409 });
      }
    }

    await sql`
      INSERT INTO event_attendees (event_id, user_id)
      VALUES (${eventId}, ${userId})
      ON CONFLICT (event_id, user_id) DO NOTHING
    `;

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/events/[id]/join error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
