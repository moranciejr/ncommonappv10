import { requireUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";

export async function POST(request) {
  try {
    const { session } = await requireUser(request);
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = await getTierForSessionEmail(session.user.email);

    return Response.json(
      {
        ok: true,
        tier,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/billing/status error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
