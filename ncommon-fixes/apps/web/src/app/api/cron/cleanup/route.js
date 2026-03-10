import sql from "@/app/api/utils/sql";

function isCronAuthorized(request) {
  try {
    const provided = request.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET || process.env.AUTH_SECRET;
    if (!provided || !expected) {
      return false;
    }
    return provided === expected;
  } catch {
    return false;
  }
}

/**
 * /api/cron/cleanup
 *
 * Housekeeping job — prune stale rows that accumulate over time.
 * Should run daily via an external scheduler.
 *
 * Cleans up:
 *  - rate_limit_counters: rows older than their own window (expired anyway)
 *  - email_verification_tokens: used or expired rows older than 7 days
 *  - password_reset_tokens: used or expired rows older than 7 days
 *  - push_tokens: disabled tokens not seen in 90 days
 *  - user_last_locations: stale location pings older than 30 days
 */
export async function POST(request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      rateLimitRows,
      emailTokenRows,
      passwordTokenRows,
      pushTokenRows,
      locationRows,
      profileViewRows,
      checkinViewRows,
    ] = await Promise.all([
      // Rate limit counters: delete rows where window has long expired (3x window as buffer)
      sql`
        DELETE FROM public.rate_limit_counters
        WHERE window_start < NOW() - (window_seconds * 3 || ' seconds')::interval
        RETURNING id
      `,

      // Email verification tokens: used or expired, older than 7 days
      sql`
        DELETE FROM email_verification_tokens
        WHERE (used = true OR expires_at < NOW())
          AND expires_at < NOW() - INTERVAL '7 days'
        RETURNING token
      `,

      // Password reset tokens: used or expired, older than 7 days
      sql`
        DELETE FROM password_reset_tokens
        WHERE (used = true OR expires_at < NOW())
          AND expires_at < NOW() - INTERVAL '7 days'
        RETURNING token
      `,

      // Push tokens: disabled and not seen in 90 days
      sql`
        DELETE FROM public.push_tokens
        WHERE disabled_at IS NOT NULL
          AND last_seen_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `,

      // Last locations: not updated in 30 days (user hasn't opened app)
      sql`
        DELETE FROM public.user_last_locations
        WHERE updated_at < NOW() - INTERVAL '30 days'
        RETURNING user_id
      `,

      // Profile views: only the 24h window matters for rate-gating; purge anything older than 30 days.
      sql`
        DELETE FROM public.profile_views
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING viewer_user_id
      `,

      // Checkin views: insights only look at last 24h; purge rows older than 30 days.
      sql`
        DELETE FROM public.checkin_views
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING checkin_id
      `,
    ]);

    const result = {
      ok: true,
      deleted: {
        rateLimitCounters: rateLimitRows?.length ?? 0,
        emailVerificationTokens: emailTokenRows?.length ?? 0,
        passwordResetTokens: passwordTokenRows?.length ?? 0,
        pushTokens: pushTokenRows?.length ?? 0,
        userLastLocations: locationRows?.length ?? 0,
        profileViews: profileViewRows?.length ?? 0,
        checkinViews: checkinViewRows?.length ?? 0,
      },
    };

    console.log("Cleanup cron completed:", result.deleted);
    return Response.json(result, { status: 200 });
  } catch (err) {
    console.error("POST /api/cron/cleanup error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Allow GET for manual health-check pings (no-op, just confirms route is live)
export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, message: "Cleanup cron is live. POST to run." }, { status: 200 });
}
