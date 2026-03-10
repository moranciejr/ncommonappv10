import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";

function parseId(raw) {
  const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toIsoDateOnly(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? trimmed : null;
  }
  return null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const habitId = parseId(params?.id);
    if (!habitId) {
      return Response.json({ error: "Invalid habit id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);

    const desiredDone = typeof body?.done === "boolean" ? body.done : null;
    const date = toIsoDateOnly(body?.date) || todayIsoDate();

    // Validate ownership + non-archived
    const habitRows = await sql(
      `
      SELECT id
      FROM productivity_habits
      WHERE id = $1 AND user_id = $2 AND is_archived = false
      LIMIT 1
      `,
      [habitId, userId],
    );

    if (!habitRows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const existingRows = await sql(
      `
      SELECT id
      FROM productivity_completions
      WHERE habit_id = $1 AND user_id = $2 AND completed_date = $3
      LIMIT 1
      `,
      [habitId, userId, date],
    );

    const hasExisting = !!existingRows?.length;

    let nextDone = hasExisting;

    if (desiredDone === true) {
      if (!hasExisting) {
        await sql(
          `
          INSERT INTO productivity_completions (habit_id, user_id, completed_date)
          VALUES ($1, $2, $3)
          ON CONFLICT (habit_id, user_id, completed_date) DO NOTHING
          `,
          [habitId, userId, date],
        );
      }
      nextDone = true;
    } else if (desiredDone === false) {
      if (hasExisting) {
        await sql(
          `
          DELETE FROM productivity_completions
          WHERE habit_id = $1 AND user_id = $2 AND completed_date = $3
          `,
          [habitId, userId, date],
        );
      }
      nextDone = false;
    } else {
      // toggle
      if (hasExisting) {
        await sql(
          `
          DELETE FROM productivity_completions
          WHERE habit_id = $1 AND user_id = $2 AND completed_date = $3
          `,
          [habitId, userId, date],
        );
        nextDone = false;
      } else {
        await sql(
          `
          INSERT INTO productivity_completions (habit_id, user_id, completed_date)
          VALUES ($1, $2, $3)
          ON CONFLICT (habit_id, user_id, completed_date) DO NOTHING
          `,
          [habitId, userId, date],
        );
        nextDone = true;
      }
    }

    return Response.json(
      { ok: true, habitId, date, done: nextDone },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/productivity/habits/[id]/toggle error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
