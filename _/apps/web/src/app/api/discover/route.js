import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

export async function GET(request) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId, session } = gate;

    // Server-side caps by tier (prevents free-tier data firehose)
    const tier = await getTierForSessionEmail(session?.user?.email);
    const limitByTier = {
      free: 100,
      plus: 300,
      premium: 600,
    };
    const limit = limitByTier[tier] || 100;

    const usage = {
      tier,
      peopleLimit: limit,
    };

    const url = new URL(request.url);
    const interest = url.searchParams.get("interest");
    const search = url.searchParams.get("search");

    const interestClean =
      typeof interest === "string" && interest.trim()
        ? interest.trim().toLowerCase().slice(0, 64)
        : null;

    const searchClean =
      typeof search === "string" && search.trim()
        ? search.trim().toLowerCase().slice(0, 80)
        : null;

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$1",
      otherUserIdColumnSql: "u.id",
    });

    const rows = await sql(
      `
      SELECT
        u.id,
        p.display_name,
        p.bio,
        p.city,
        p.state,
        p.avatar_url,
        COALESCE(
          (
            SELECT json_agg(ui.interest ORDER BY ui.interest)
            FROM user_interests ui
            WHERE ui.user_id = u.id
          ),
          '[]'::json
        ) AS interests
      FROM auth_users u
      JOIN user_profiles p ON p.user_id = u.id
      WHERE p.onboarding_completed_at IS NOT NULL
        AND u.id <> $1
        AND ${blocksClause}
        AND ($2::text IS NULL OR EXISTS (
          SELECT 1 FROM user_interests ui2
          WHERE ui2.user_id = u.id AND ui2.interest = $2
        ))
        AND (
          $3::text IS NULL
          OR LOWER(p.display_name) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.bio, '')) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.city, '')) LIKE '%' || $3 || '%'
          OR LOWER(COALESCE(p.state, '')) LIKE '%' || $3 || '%'
        )
      ORDER BY p.onboarding_completed_at DESC
      LIMIT $4
      `,
      [userId, interestClean, searchClean, limit],
    );

    const users = (rows || []).map((r) => {
      let interestsArr = [];
      if (Array.isArray(r.interests)) {
        interestsArr = r.interests;
      } else if (typeof r.interests === "string") {
        try {
          const parsed = JSON.parse(r.interests);
          interestsArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          interestsArr = [];
        }
      }

      return {
        id: r.id,
        displayName: r.display_name || "",
        bio: r.bio || "",
        city: r.city || "",
        state: r.state || "",
        avatarUrl: r.avatar_url || "",
        interests: interestsArr,
      };
    });

    return Response.json({ ok: true, users, usage }, { status: 200 });
  } catch (err) {
    console.error("GET /api/discover error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
