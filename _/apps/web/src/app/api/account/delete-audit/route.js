import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";

function parseIntSafe(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function toCount(row) {
  const raw = row?.count;
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Number.isFinite(n) ? n : 0;
}

function canAuditOtherUsers(request) {
  // Allow admin-style audits in dev, or when a secret header is provided.
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const secret = request?.headers?.get("x-cron-secret") || "";
  // We intentionally reuse AUTH_SECRET here so we don't introduce a new env var
  // surface area just for audits.
  const expected = process.env.AUTH_SECRET;

  return !!expected && secret === expected;
}

export async function GET(request) {
  try {
    const gate = await requireUser(request);
    if (!gate?.session || !gate?.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedUserId = parseIntSafe(url.searchParams.get("userId"));

    const targetUserId = requestedUserId ?? gate.userId;

    if (requestedUserId && requestedUserId !== gate.userId) {
      if (!canAuditOtherUsers(request)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const results = await sql.transaction((txn) => [
      // Does auth user still exist?
      txn("SELECT COUNT(*)::int AS count FROM auth_users WHERE id = $1", [
        targetUserId,
      ]),

      // Auth/session tables
      txn(
        'SELECT COUNT(*)::int AS count FROM auth_accounts WHERE "userId" = $1',
        [targetUserId],
      ),
      txn(
        'SELECT COUNT(*)::int AS count FROM auth_sessions WHERE "userId" = $1',
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM email_verification_tokens WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM password_reset_tokens WHERE user_id = $1",
        [targetUserId],
      ),

      // Core app tables
      txn("SELECT COUNT(*)::int AS count FROM push_tokens WHERE user_id = $1", [
        targetUserId,
      ]),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_profiles WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM profile_photos WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_interests WHERE user_id = $1",
        [targetUserId],
      ),

      txn("SELECT COUNT(*)::int AS count FROM checkins WHERE user_id = $1", [
        targetUserId,
      ]),
      txn(
        "SELECT COUNT(*)::int AS count FROM checkin_requests WHERE requester_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM checkin_views WHERE viewer_user_id = $1",
        [targetUserId],
      ),

      txn(
        "SELECT COUNT(*)::int AS count FROM events WHERE creator_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM event_attendees WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM event_invites WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM event_invites WHERE inviter_user_id = $1",
        [targetUserId],
      ),

      // Social tables
      txn(
        "SELECT COUNT(*)::int AS count FROM friend_requests WHERE requester_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM friend_requests WHERE target_user_id = $1",
        [targetUserId],
      ),
      txn("SELECT COUNT(*)::int AS count FROM friendships WHERE user_id = $1", [
        targetUserId,
      ]),
      txn(
        "SELECT COUNT(*)::int AS count FROM friendships WHERE friend_user_id = $1",
        [targetUserId],
      ),

      txn(
        "SELECT COUNT(*)::int AS count FROM user_blocks WHERE blocker_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_blocks WHERE blocked_user_id = $1",
        [targetUserId],
      ),
      txn("SELECT COUNT(*)::int AS count FROM user_stars WHERE user_id = $1", [
        targetUserId,
      ]),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_stars WHERE target_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_reports WHERE reporter_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM user_reports WHERE target_user_id = $1",
        [targetUserId],
      ),

      // Comms
      txn(
        "SELECT COUNT(*)::int AS count FROM conversation_participants WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM messages WHERE sender_user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1",
        [targetUserId],
      ),

      // Telemetry (we delete these explicitly during deletion)
      txn(
        "SELECT COUNT(*)::int AS count FROM analytics_events WHERE user_id = $1",
        [targetUserId],
      ),
      txn(
        "SELECT COUNT(*)::int AS count FROM crash_reports WHERE user_id = $1",
        [targetUserId],
      ),
    ]);

    const [
      authUsers,
      authAccounts,
      authSessions,
      emailTokens,
      resetTokens,
      pushTokens,
      userProfiles,
      profilePhotos,
      userInterests,
      checkins,
      checkinRequests,
      checkinViews,
      events,
      eventAttendees,
      eventInvitesUser,
      eventInvitesInviter,
      friendReqOut,
      friendReqIn,
      friendshipsOut,
      friendshipsIn,
      blocksOut,
      blocksIn,
      starsOut,
      starsIn,
      reportsOut,
      reportsIn,
      convParticipants,
      messages,
      notifications,
      analytics,
      crashes,
    ] = results;

    const counts = {
      authUser: toCount(authUsers?.[0]),
      authAccounts: toCount(authAccounts?.[0]),
      authSessions: toCount(authSessions?.[0]),
      emailVerificationTokens: toCount(emailTokens?.[0]),
      passwordResetTokens: toCount(resetTokens?.[0]),

      pushTokens: toCount(pushTokens?.[0]),
      userProfiles: toCount(userProfiles?.[0]),
      profilePhotos: toCount(profilePhotos?.[0]),
      userInterests: toCount(userInterests?.[0]),

      checkins: toCount(checkins?.[0]),
      checkinRequests: toCount(checkinRequests?.[0]),
      checkinViews: toCount(checkinViews?.[0]),

      events: toCount(events?.[0]),
      eventAttendees: toCount(eventAttendees?.[0]),
      eventInvitesAsInvitee: toCount(eventInvitesUser?.[0]),
      eventInvitesAsInviter: toCount(eventInvitesInviter?.[0]),

      friendRequestsSent: toCount(friendReqOut?.[0]),
      friendRequestsReceived: toCount(friendReqIn?.[0]),
      friendships: toCount(friendshipsOut?.[0]) + toCount(friendshipsIn?.[0]),
      blocks: toCount(blocksOut?.[0]) + toCount(blocksIn?.[0]),
      stars: toCount(starsOut?.[0]) + toCount(starsIn?.[0]),
      reports: toCount(reportsOut?.[0]) + toCount(reportsIn?.[0]),

      conversationParticipants: toCount(convParticipants?.[0]),
      messagesSent: toCount(messages?.[0]),
      notifications: toCount(notifications?.[0]),

      analyticsEvents: toCount(analytics?.[0]),
      crashReports: toCount(crashes?.[0]),
    };

    // For "post-delete" audits, the key signal is whether anything remains besides authUser (should be 0 too)
    // and whether telemetry tables are 0.
    const totalRemaining = Object.entries(counts)
      .filter(([k]) => k !== "authUser")
      .reduce((sum, [, v]) => sum + (Number.isFinite(v) ? v : 0), 0);

    return Response.json(
      {
        ok: true,
        userId: targetUserId,
        authUserExists: counts.authUser > 0,
        totalRemaining,
        counts,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/account/delete-audit error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
