import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import {
  getActiveTierForCustomer,
  getOrCreateCustomerByEmail,
} from "@/app/api/utils/stripe-rest";
import { isBlockedPair } from "@/app/api/utils/blocks";

function toInt(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!n || Number.isNaN(n)) {
    return null;
  }
  return n;
}

function computeAgeYears(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

async function getTierForSessionEmail(email) {
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

export async function GET(request, { params }) {
  const targetUserId = toInt(params?.id);
  if (!targetUserId) {
    return Response.json({ error: "Invalid user id" }, { status: 400 });
  }

  const { session, userId } = await requireUser(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hide users that are blocked in either direction.
  const blocked = await isBlockedPair(sql, userId, targetUserId);
  if (blocked) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // ---- NEW: profile view limits + upgrade nudges (Free tier) ----
  const tier = await getTierForSessionEmail(session?.user?.email);

  let usage = {
    tier,
    profileViewsLast24h: null,
    profileViewLimit: null,
  };

  let upgradeNudge = null;

  const isSelfView = userId === targetUserId;

  if (!isSelfView) {
    const limit = 25;
    const warnAt = 20;

    // If they've already viewed this profile in the last 24h, don't count it again.
    const alreadyViewedRows = await sql`
      SELECT 1
      FROM profile_views
      WHERE viewer_user_id = ${userId}
        AND viewed_user_id = ${targetUserId}
        AND created_at > now() - interval '24 hours'
      LIMIT 1
    `;

    const alreadyViewed = !!alreadyViewedRows.length;

    const countRows = await sql`
      SELECT COUNT(DISTINCT viewed_user_id)::int AS count
      FROM profile_views
      WHERE viewer_user_id = ${userId}
        AND created_at > now() - interval '24 hours'
    `;

    const currentCount = countRows?.[0]?.count || 0;

    usage = {
      tier,
      profileViewsLast24h: currentCount,
      profileViewLimit: tier === "free" ? limit : null,
    };

    if (tier === "free" && !alreadyViewed && currentCount >= limit) {
      upgradeNudge = {
        title: "Daily profile views reached",
        message:
          "You’ve hit 25 profile views in the last 24 hours. Upgrade to keep browsing without limits.",
        primaryCta: "Upgrade",
        secondaryCta: "Not now",
        target: "/upgrade",
        reason: "profile_views_limit",
      };

      return Response.json(
        {
          error: "Daily profile view limit reached",
          upgradeNudge,
          usage,
        },
        { status: 402 },
      );
    }

    // Record the view (only once per profile per 24h).
    if (!alreadyViewed) {
      await sql`
        INSERT INTO profile_views (viewer_user_id, viewed_user_id)
        VALUES (${userId}, ${targetUserId})
      `;

      const afterRows = await sql`
        SELECT COUNT(DISTINCT viewed_user_id)::int AS count
        FROM profile_views
        WHERE viewer_user_id = ${userId}
          AND created_at > now() - interval '24 hours'
      `;

      const afterCount = afterRows?.[0]?.count || currentCount;

      usage = {
        tier,
        profileViewsLast24h: afterCount,
        profileViewLimit: tier === "free" ? limit : null,
      };

      if (tier === "free" && afterCount >= warnAt) {
        upgradeNudge = {
          title: "You’re almost at your daily limit",
          message: `You’ve viewed ${afterCount} of ${limit} profiles in the last 24 hours. Upgrade for unlimited browsing.`,
          primaryCta: "Upgrade",
          secondaryCta: "Keep browsing",
          target: "/upgrade",
          reason: "profile_views_near_limit",
        };
      }
    }
  }

  const userRows = await sql`
    SELECT
      u.id,
      u.name,
      u.email,
      u.image,
      u."emailVerified" AS email_verified,
      p.display_name,
      p.bio,
      p.city,
      p.state,
      p.avatar_url,
      p.gender,
      p.relationship_status,
      p.mood,
      p.appear_offline,
      p.hide_distance,
      p.is_minor,
      p.show_age,
      p.date_of_birth
    FROM auth_users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.id = ${targetUserId}
    LIMIT 1
  `;

  const row = userRows?.[0];
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const interestsRows = await sql`
    SELECT interest
    FROM user_interests
    WHERE user_id = ${targetUserId}
    ORDER BY created_at ASC
    LIMIT 30
  `;

  const photosRows = await sql`
    SELECT id, url, sort_order
    FROM profile_photos
    WHERE user_id = ${targetUserId}
    ORDER BY sort_order ASC
    LIMIT 10
  `;

  const checkinRows = await sql`
    SELECT
      id,
      location_name,
      note,
      interest,
      place_id,
      place_address,
      lat,
      lng,
      starts_at,
      expires_at
    FROM checkins
    WHERE user_id = ${targetUserId}
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const isStarredRows = await sql`
    SELECT 1
    FROM user_stars
    WHERE user_id = ${userId}
      AND target_user_id = ${targetUserId}
    LIMIT 1
  `;

  const isFriendRows = await sql`
    SELECT 1
    FROM friendships
    WHERE user_id = ${userId}
      AND friend_user_id = ${targetUserId}
    LIMIT 1
  `;

  // Meetup counts — mutual confirmations only.
  const meetupCountRows = await sql(
    `
    SELECT COUNT(DISTINCT mc_out.confirmed_user_id)::int AS meetup_count,
           COUNT(DISTINCT CASE WHEN mc_out.would_meet_again AND mc_in.would_meet_again
                               THEN mc_out.confirmed_user_id END)::int AS would_meet_again_count
    FROM public.meetup_confirmations mc_out
    JOIN public.meetup_confirmations mc_in
      ON mc_in.checkin_id        = mc_out.checkin_id
     AND mc_in.confirmer_user_id = mc_out.confirmed_user_id
     AND mc_in.confirmed_user_id = mc_out.confirmer_user_id
    WHERE mc_out.confirmer_user_id = $1
    `,
    [targetUserId],
  );
  const meetupCount = meetupCountRows?.[0]?.meetup_count || 0;
  const wouldMeetAgainCount = meetupCountRows?.[0]?.would_meet_again_count || 0;

  const showAge = !!row.show_age;
  const age = showAge ? computeAgeYears(row.date_of_birth) : null;

  return Response.json({
    user: {
      id: row.id,
      displayName: row.display_name || row.name || "User",
      bio: row.bio || "",
      city: row.city || "",
      state: row.state || "",
      avatarUrl: row.avatar_url || row.image || "",
      isVerified: !!row.email_verified,
      isMinor: !!row.is_minor,
      showAge,
      age,
      gender: row.gender || "",
      relationshipStatus: row.relationship_status || "",
      mood: row.mood || "",
      appearOffline: !!row.appear_offline,
      hideDistance: !!row.hide_distance,
    },
    interests: interestsRows.map((r) => r.interest),
    photos: photosRows.map((p) => ({
      id: p.id,
      url: p.url,
      sortOrder: p.sort_order,
    })),
    activeCheckin: checkinRows?.[0]
      ? {
          id: checkinRows[0].id,
          locationName: checkinRows[0].location_name,
          note: checkinRows[0].note,
          interest: checkinRows[0].interest,
          placeId: checkinRows[0].place_id,
          placeAddress: checkinRows[0].place_address,
          lat: checkinRows[0].lat,
          lng: checkinRows[0].lng,
          startsAt: checkinRows[0].starts_at,
          expiresAt: checkinRows[0].expires_at,
        }
      : null,
    meetups: {
      count: meetupCount,
      wouldMeetAgainCount,
    },
    viewer: {
      isMe: userId === targetUserId,
      isStarred: !!isStarredRows.length,
      isFriend: !!isFriendRows.length,
    },
    usage,
    upgradeNudge,
  });
}
