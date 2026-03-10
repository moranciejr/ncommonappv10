import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userId = gate?.userId;

    if (!gate?.session || !userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete user-linked analytics/crash rows explicitly (these FKs are SET NULL)
    // and then delete the auth user (CASCADE cleans up most app tables).
    await sql.transaction((txn) => [
      txn("DELETE FROM analytics_events WHERE user_id = $1", [userId]),
      txn("DELETE FROM crash_reports WHERE user_id = $1", [userId]),
      txn("DELETE FROM auth_users WHERE id = $1", [userId]),
    ]);

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/account/delete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
