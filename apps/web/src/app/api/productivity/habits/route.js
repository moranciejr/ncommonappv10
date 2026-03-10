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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreakForHabit(completedDateSet) {
  // Streak counts consecutive days ending today.
  if (!completedDateSet || typeof completedDateSet.has !== "function") {
    return 0;
  }

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (completedDateSet.has(iso)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const today = todayIsoDate();

    const habitRows = await sql(
      `
      SELECT id, title, category, color, is_archived, created_at, updated_at
      FROM productivity_habits
      WHERE user_id = $1 AND is_archived = false
      ORDER BY created_at DESC
      `,
      [userId],
    );

    const habits = (habitRows || []).map((r) => ({
      id: Number(r.id),
      title: r.title,
      category: r.category,
      color: r.color || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    const completionRows = await sql(
      `
      SELECT habit_id, completed_date
      FROM productivity_completions
      WHERE user_id = $1
        AND completed_date >= (CURRENT_DATE - INTERVAL '30 days')
      `,
      [userId],
    );

    const datesByHabitId = new Map();
    for (const row of completionRows || []) {
      const habitId = Number(row.habit_id);
      const dateIso =
        typeof row.completed_date === "string"
          ? row.completed_date
          : row.completed_date?.toISOString?.().slice(0, 10);

      if (!dateIso) {
        continue;
      }

      if (!datesByHabitId.has(habitId)) {
        datesByHabitId.set(habitId, new Set());
      }
      datesByHabitId.get(habitId).add(dateIso);
    }

    const decoratedHabits = habits.map((h) => {
      const set = datesByHabitId.get(h.id);
      const doneToday = !!set?.has(today);
      const streak = computeStreakForHabit(set);
      return {
        ...h,
        doneToday,
        streak,
      };
    });

    const weekRows = await sql(
      `
      SELECT completed_date, COUNT(*)::int AS done_count
      FROM productivity_completions
      WHERE user_id = $1
        AND completed_date >= (CURRENT_DATE - INTERVAL '6 days')
      GROUP BY completed_date
      ORDER BY completed_date ASC
      `,
      [userId],
    );

    const byDate = new Map();
    for (const r of weekRows || []) {
      const dateIso =
        typeof r.completed_date === "string"
          ? r.completed_date
          : r.completed_date?.toISOString?.().slice(0, 10);
      if (dateIso) {
        byDate.set(dateIso, Number(r.done_count) || 0);
      }
    }

    const week = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      );
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      week.push({ date: iso, doneCount: byDate.get(iso) || 0 });
    }

    const doneTodayCount = decoratedHabits.filter((h) => h.doneToday).length;

    return Response.json(
      {
        ok: true,
        today,
        habits: decoratedHabits,
        summary: {
          totalHabits: decoratedHabits.length,
          doneToday: doneTodayCount,
          week,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/productivity/habits error", err);
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

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "create_habit",
      windowSeconds: 86400,
      limit: 30,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many habits created today. Try again tomorrow." },
        { status: 429 },
      );
    }

        const body = await request.json().catch(() => null);

    const title = cleanText(body?.title, { maxLen: 120, allowEmpty: false });
    const categoryRaw = cleanText(body?.category, {
      maxLen: 32,
      allowEmpty: true,
    });
    const category = categoryRaw ? categoryRaw.toLowerCase() : "general";

    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    // Enforce a per-user habit cap to prevent unbounded table growth.
    const habitCountRows = await sql(
      `SELECT COUNT(*)::int AS count FROM productivity_habits WHERE user_id = $1 AND is_archived = false`,
      [userId],
    );
    const habitCount = habitCountRows?.[0]?.count || 0;
    const MAX_HABITS = 30;
    if (habitCount >= MAX_HABITS) {
      return Response.json(
        { error: `You can have at most ${MAX_HABITS} active habits. Archive some to add more.` },
        { status: 400 },
      );
    }

    const inserted = await sql(
      `
      INSERT INTO productivity_habits (user_id, title, category)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [userId, title, category],
    );

    const id = inserted?.[0]?.id;

    return Response.json({ ok: true, id: Number(id) }, { status: 200 });
  } catch (err) {
    console.error("POST /api/productivity/habits error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
