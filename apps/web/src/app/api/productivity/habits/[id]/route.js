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

function parseId(raw) {
  const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Accepts a hex color string like "#a0c4ff" or null to clear.
function cleanColor(value) {
  if (value === null || value === undefined) {
    return undefined; // undefined = not provided, don't touch it
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null; // empty string → clear the color
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return undefined; // invalid — ignore
}

export async function PATCH(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const withinLimit = await consumeRateLimit(sql, {
      userId,
      action: "habit_edit",
      windowSeconds: 3600,
      limit: 60,
    });
    if (!withinLimit) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

        const habitId = parseId(params?.id);
    if (!habitId) {
      return Response.json({ error: "Invalid habit id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);

    const setClauses = [];
    const values = [];
    let idx = 1;

    const title = cleanText(body?.title, { maxLen: 120, allowEmpty: true });
    if (typeof title === "string" && title.trim()) {
      setClauses.push(`title = $${idx}`);
      values.push(title.trim());
      idx += 1;
    }

    const categoryRaw = cleanText(body?.category, {
      maxLen: 32,
      allowEmpty: true,
    });
    if (typeof categoryRaw === "string" && categoryRaw.trim()) {
      setClauses.push(`category = $${idx}`);
      values.push(categoryRaw.trim().toLowerCase());
      idx += 1;
    }

    if (typeof body?.isArchived === "boolean") {
      setClauses.push(`is_archived = $${idx}`);
      values.push(body.isArchived);
      idx += 1;
    }

    const color = cleanColor(body?.color);
    if (color !== undefined) {
      setClauses.push(`color = $${idx}`);
      values.push(color); // null clears it, string sets it
      idx += 1;
    }

    if (!setClauses.length) {
      return Response.json({ ok: true }, { status: 200 });
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(userId);
    values.push(habitId);

    const query = `
      UPDATE productivity_habits
      SET ${setClauses.join(", ")}
      WHERE user_id = $${idx} AND id = $${idx + 1}
      RETURNING id
    `;

    const rows = await sql(query, values);
    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/productivity/habits/[id] error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
