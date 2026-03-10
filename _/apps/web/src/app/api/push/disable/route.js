import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";

function cleanToken(value) {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim();
  if (!token) {
    return null;
  }
  return token.length > 512 ? token.slice(0, 512) : token;
}

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    if (!gate?.session || !gate?.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const token = cleanToken(body?.token);

    if (!token) {
      return Response.json({ error: "token is required" }, { status: 400 });
    }

    const rows = await sql(
      `
      UPDATE public.push_tokens
      SET disabled_at = NOW(), updated_at = NOW()
      WHERE token = $1
      RETURNING id
      `,
      [token],
    );

    return Response.json(
      { ok: true, disabled: !!rows?.length },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/push/disable error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
