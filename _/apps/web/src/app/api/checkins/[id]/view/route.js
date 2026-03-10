import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";
import {
  getActiveTierForCustomer,
  getOrCreateCustomerByEmail,
} from "@/app/api/utils/stripe-rest";
import { blockPairNotExistsClause } from "@/app/api/utils/blocks";

function parseId(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

async function getTierForEmail(email) {
  const safe = typeof email === "string" ? email.trim() : "";
  if (!safe) {
    return "free";
  }

  try {
    const customer = await getOrCreateCustomerByEmail(safe);
    const customerId = customer?.id || null;
    const tierInfo = await getActiveTierForCustomer(customerId);
    return tierInfo?.tier || "free";
  } catch (err) {
    console.error("Failed to read Stripe tier; defaulting to free", err);
    return "free";
  }
}

export async function POST(request, { params }) {
  try {
    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;
    const checkinId = parseId(params?.id);

    if (!checkinId) {
      return Response.json({ error: "Invalid check-in id" }, { status: 400 });
    }

    const blocksClause = blockPairNotExistsClause({
      viewerUserIdSql: "$2",
      otherUserIdColumnSql: "c.user_id",
    });

    // Confirm check-in is active and visible to the viewer (block filtering).
    const rows = await sql(
      `
      SELECT c.user_id
      FROM checkins c
      JOIN user_profiles p ON p.user_id = c.user_id
      WHERE c.id = $1
        AND c.expires_at > NOW()
        AND p.onboarding_completed_at IS NOT NULL
        AND (
          c.user_id = $2
          OR ${blocksClause}
        )
      LIMIT 1
      `,
      [checkinId, userId],
    );

    if (!rows?.length) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const ownerUserId = rows[0].user_id;

    if (ownerUserId === userId) {
      // Don't record self-views.
      return Response.json({ ok: true, viewed: false }, { status: 200 });
    }

    // Record view (idempotent per viewer)
    const inserted = await sql(
      `
      INSERT INTO checkin_views (checkin_id, viewer_user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (checkin_id, viewer_user_id)
      DO UPDATE SET created_at = EXCLUDED.created_at
      RETURNING (xmax = 0) AS inserted
      `,
      [checkinId, userId],
    );

    const didInsert = !!inserted?.[0]?.inserted;

    // Notify owner only on the first view from this viewer.
    // Premium feature: view alerts are only sent for Plus/Premium owners.
    let notified = false;
    if (didInsert) {
      const ownerRows = await sql(
        `
        SELECT u.email, p.notif_plan_views
        FROM auth_users u
        JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
        `,
        [ownerUserId],
      );

      const ownerEmail = ownerRows?.[0]?.email || "";
      const ownerTier = await getTierForEmail(ownerEmail);
      const ownerAllows = ownerRows?.[0]?.notif_plan_views === true;

      if (ownerTier !== "free" && ownerAllows) {
        await sql(
          `
          INSERT INTO notifications (user_id, type, payload)
          VALUES ($1, 'checkin_view', jsonb_build_object('checkinId', $2, 'viewerUserId', $3))
          `,
          [ownerUserId, checkinId, userId],
        );
        notified = true;
      }
    }

    return Response.json({ ok: true, viewed: true, notified }, { status: 200 });
  } catch (err) {
    console.error("POST /api/checkins/[id]/view error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
