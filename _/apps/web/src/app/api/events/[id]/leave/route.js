import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";

export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const rawId = params?.id;
    const eventId = rawId ? parseInt(rawId, 10) : NaN;

    if (!eventId || Number.isNaN(eventId)) {
      return Response.json({ error: "Invalid event id" }, { status: 400 });
    }

    await sql`
      DELETE FROM event_attendees
      WHERE event_id = ${eventId} AND user_id = ${userId}
    `;

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/events/[id]/leave error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
