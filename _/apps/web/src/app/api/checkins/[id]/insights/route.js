import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export async function GET(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;
    const checkinId = parseId(params?.id);
    if (!checkinId) {
      return Response.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const ownerRows = await sql(
      `
      SELECT c.user_id, p.notif_plan_views
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      WHERE c.id = $1
      LIMIT 1
      `,
      [checkinId],
    );

    const ownerId = ownerRows?.[0]?.user_id || null;
    const viewAlertsEnabled = ownerRows?.[0]?.notif_plan_views !== false;

    if (!ownerId || ownerId !== userId) {
      // Hide existence if not the owner
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const tier = await getTierForSessionEmail(session?.user?.email);

    const countRows = await sql(
      `
      SELECT COUNT(*)::int AS count
      FROM checkin_views
      WHERE checkin_id = $1
        AND created_at > now() - interval '24 hours'
      `,
      [checkinId],
    );

    const viewsLast24h = countRows?.[0]?.count || 0;

    const usage = {
      tier,
      viewsLast24h,
      viewAlertsEnabled: tier !== "free" && viewAlertsEnabled,
    };

    if (tier === "free") {
      return Response.json(
        {
          ok: true,
          locked: true,
          usage,
          viewers: [],
          upgradeNudge: {
            title: "See who viewed your plan",
            message:
              "Free shows view counts only. Upgrade to Plus to see the people who viewed your plan and follow up faster.",
            primaryCta: "Upgrade",
            secondaryCta: "Not now",
            target: "/upgrade",
            reason: "plan_insights_locked_free",
          },
        },
        { status: 200 },
      );
    }

    const viewerRows = await sql(
      `
      SELECT
        v.viewer_user_id,
        v.created_at,
        up.display_name,
        up.avatar_url,
        up.is_minor
      FROM checkin_views v
      JOIN user_profiles up ON up.user_id = v.viewer_user_id
      WHERE v.checkin_id = $1
        AND v.created_at > now() - interval '24 hours'
      ORDER BY v.created_at DESC
      LIMIT 40
      `,
      [checkinId],
    );

    const viewers = (viewerRows || []).map((r) => ({
      userId: r.viewer_user_id,
      displayName: r.display_name || "",
      avatarUrl: r.avatar_url || "",
      isMinor: !!r.is_minor,
      viewedAt: r.created_at,
    }));

    return Response.json(
      {
        ok: true,
        locked: false,
        usage,
        viewers,
        upgradeNudge: null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/checkins/[id]/insights error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
