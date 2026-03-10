import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function toBool(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function toInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function clampInt(value, min, max, fallback) {
  const n = toInt(value);
  if (n === null) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function cleanGender(value) {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "male" || v === "female" || v === "any") {
    return v;
  }
  return null;
}

async function ensureProfileRow(userId) {
  // Create a stub profile row if one doesn't exist yet.
  // This keeps settings endpoints safe even if onboarding isn't finished.
  await sql(
    `
    INSERT INTO user_profiles (user_id, created_at, updated_at)
    VALUES ($1, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );
}

export async function GET(request) {
  try {
    const gate = await requireUser(request);
    const userIdRaw = gate?.userId;

    if (!gate?.session || !userIdRaw) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : userIdRaw;
    if (!userId || Number.isNaN(userId)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureProfileRow(userId);

    const rows = await sql(
      `
      SELECT
        appear_offline,
        hide_distance,
        show_age,
        hide_minors,
        only_verified,
        strict_mutual_interests,
        notif_plan_views,
        notif_nearby_plans,
        notif_join_requests,
        notif_request_updates,
        notif_messages,
        quiet_hours_start,
        quiet_hours_end,
        default_plan_expires_minutes,
        default_desired_group_size,
        default_desired_gender
      FROM user_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const row = rows?.[0] || {};

    return Response.json(
      {
        ok: true,
        settings: {
          appearOffline: !!row.appear_offline,
          hideDistance: !!row.hide_distance,
          showAge: !!row.show_age,

          // Safety / Discovery
          hideMinors: !!row.hide_minors,
          onlyVerified: !!row.only_verified,
          strictMutualInterests: !!row.strict_mutual_interests,

          // Notifications
          notifPlanViews: row.notif_plan_views !== false,
          notifNearbyPlans: row.notif_nearby_plans !== false,
          notifJoinRequests: row.notif_join_requests !== false,
          notifRequestUpdates: row.notif_request_updates !== false,
          notifMessages: row.notif_messages !== false,

          // Quiet hours + plan defaults
          quietHoursStart: Number.isFinite(row.quiet_hours_start)
            ? Number(row.quiet_hours_start)
            : 22,
          quietHoursEnd: Number.isFinite(row.quiet_hours_end)
            ? Number(row.quiet_hours_end)
            : 8,
          defaultPlanExpiresMinutes: Number.isFinite(
            row.default_plan_expires_minutes,
          )
            ? Number(row.default_plan_expires_minutes)
            : 120,
          defaultDesiredGroupSize:
            row.default_desired_group_size === null
              ? null
              : Number(row.default_desired_group_size),
          defaultDesiredGender: row.default_desired_gender || "any",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/profile/settings error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const gate = await requireUser(request);
    const userIdRaw = gate?.userId;

    if (!gate?.session || !userIdRaw) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : userIdRaw;
    if (!userId || Number.isNaN(userId)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const appearOffline = toBool(body?.appearOffline);
    const hideDistance = toBool(body?.hideDistance);
    const showAge = toBool(body?.showAge);

    const hideMinors = toBool(body?.hideMinors);
    const onlyVerified = toBool(body?.onlyVerified);
    const strictMutualInterests = toBool(body?.strictMutualInterests);

    const notifPlanViews = toBool(body?.notifPlanViews);
    const notifNearbyPlans = toBool(body?.notifNearbyPlans);
    const notifJoinRequests = toBool(body?.notifJoinRequests);
    const notifRequestUpdates = toBool(body?.notifRequestUpdates);
    const notifMessages = toBool(body?.notifMessages);

    const quietHoursStart =
      body?.quietHoursStart === undefined
        ? null
        : clampInt(body?.quietHoursStart, 0, 23, null);
    const quietHoursEnd =
      body?.quietHoursEnd === undefined
        ? null
        : clampInt(body?.quietHoursEnd, 0, 23, null);

    const defaultPlanExpiresMinutes =
      body?.defaultPlanExpiresMinutes === undefined
        ? null
        : clampInt(body?.defaultPlanExpiresMinutes, 15, 1440, null);

    const defaultDesiredGroupSize =
      body?.defaultDesiredGroupSize === undefined
        ? null
        : body?.defaultDesiredGroupSize === null
          ? null
          : clampInt(body?.defaultDesiredGroupSize, 1, 25, null);

    const defaultDesiredGender =
      body?.defaultDesiredGender === undefined
        ? null
        : cleanGender(body?.defaultDesiredGender);

    // At least one field must be provided
    if (
      appearOffline === null &&
      hideDistance === null &&
      showAge === null &&
      hideMinors === null &&
      onlyVerified === null &&
      strictMutualInterests === null &&
      notifPlanViews === null &&
      notifNearbyPlans === null &&
      notifJoinRequests === null &&
      notifRequestUpdates === null &&
      notifMessages === null &&
      quietHoursStart === null &&
      quietHoursEnd === null &&
      defaultPlanExpiresMinutes === null &&
      defaultDesiredGroupSize === null &&
      defaultDesiredGender === null
    ) {
      return Response.json({ error: "No settings provided" }, { status: 400 });
    }

    // Validate gender if provided but invalid
    if (
      body?.defaultDesiredGender !== undefined &&
      defaultDesiredGender === null
    ) {
      return Response.json(
        { error: "defaultDesiredGender must be any, male, or female" },
        { status: 400 },
      );
    }

    await ensureProfileRow(userId);

    const sets = [];
    const values = [];
    let i = 1;

    if (appearOffline !== null) {
      sets.push(`appear_offline = $${i++}`);
      values.push(appearOffline);
    }

    if (hideDistance !== null) {
      sets.push(`hide_distance = $${i++}`);
      values.push(hideDistance);
    }

    if (showAge !== null) {
      sets.push(`show_age = $${i++}`);
      values.push(showAge);
    }

    if (hideMinors !== null) {
      sets.push(`hide_minors = $${i++}`);
      values.push(hideMinors);
    }

    if (onlyVerified !== null) {
      sets.push(`only_verified = $${i++}`);
      values.push(onlyVerified);
    }

    if (strictMutualInterests !== null) {
      sets.push(`strict_mutual_interests = $${i++}`);
      values.push(strictMutualInterests);
    }

    if (notifPlanViews !== null) {
      sets.push(`notif_plan_views = $${i++}`);
      values.push(notifPlanViews);
    }

    if (notifNearbyPlans !== null) {
      sets.push(`notif_nearby_plans = $${i++}`);
      values.push(notifNearbyPlans);
    }

    if (notifJoinRequests !== null) {
      sets.push(`notif_join_requests = $${i++}`);
      values.push(notifJoinRequests);
    }

    if (notifRequestUpdates !== null) {
      sets.push(`notif_request_updates = $${i++}`);
      values.push(notifRequestUpdates);
    }

    if (notifMessages !== null) {
      sets.push(`notif_messages = $${i++}`);
      values.push(notifMessages);
    }

    if (quietHoursStart !== null) {
      sets.push(`quiet_hours_start = $${i++}`);
      values.push(quietHoursStart);
    }

    if (quietHoursEnd !== null) {
      sets.push(`quiet_hours_end = $${i++}`);
      values.push(quietHoursEnd);
    }

    if (defaultPlanExpiresMinutes !== null) {
      sets.push(`default_plan_expires_minutes = $${i++}`);
      values.push(defaultPlanExpiresMinutes);
    }

    if (body?.defaultDesiredGroupSize !== undefined) {
      sets.push(`default_desired_group_size = $${i++}`);
      values.push(defaultDesiredGroupSize);
    }

    if (defaultDesiredGender !== null) {
      sets.push(`default_desired_gender = $${i++}`);
      values.push(defaultDesiredGender);
    }

    sets.push(`updated_at = NOW()`);

    values.push(userId);

    const query = `
      UPDATE user_profiles
      SET ${sets.join(", ")}
      WHERE user_id = $${i}
      RETURNING
        appear_offline,
        hide_distance,
        show_age,
        hide_minors,
        only_verified,
        strict_mutual_interests,
        notif_plan_views,
        notif_nearby_plans,
        notif_join_requests,
        notif_request_updates,
        notif_messages,
        quiet_hours_start,
        quiet_hours_end,
        default_plan_expires_minutes,
        default_desired_group_size,
        default_desired_gender
    `;

    const rows = await sql(query, values);
    const row = rows?.[0] || {};

    return Response.json(
      {
        ok: true,
        settings: {
          appearOffline: !!row.appear_offline,
          hideDistance: !!row.hide_distance,
          showAge: !!row.show_age,
          hideMinors: !!row.hide_minors,
          onlyVerified: !!row.only_verified,
          strictMutualInterests: !!row.strict_mutual_interests,
          notifPlanViews: row.notif_plan_views !== false,
          notifNearbyPlans: row.notif_nearby_plans !== false,
          notifJoinRequests: row.notif_join_requests !== false,
          notifRequestUpdates: row.notif_request_updates !== false,
          notifMessages: row.notif_messages !== false,
          quietHoursStart: Number(row.quiet_hours_start),
          quietHoursEnd: Number(row.quiet_hours_end),
          defaultPlanExpiresMinutes: Number(row.default_plan_expires_minutes),
          defaultDesiredGroupSize:
            row.default_desired_group_size === null
              ? null
              : Number(row.default_desired_group_size),
          defaultDesiredGender: row.default_desired_gender || "any",
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/profile/settings error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
