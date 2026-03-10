import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";
import { getTierForSessionEmail } from "@/app/api/utils/tier";

function toIsoDateOnly(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? trimmed : "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return "";
}

export async function GET(request) {
  try {
    const gate = await requireUser(request);

    if (!gate?.session || !gate?.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, session } = gate;

    const tier = await getTierForSessionEmail(session?.user?.email);

    const [userRows, profileRows, interestRows, photoRows] =
      await sql.transaction([
        sql`
          SELECT id, email, name, image, "emailVerified"
          FROM auth_users
          WHERE id = ${userId}
          LIMIT 1
        `,
        sql`
          SELECT
            display_name,
            bio,
            city,
            state,
            avatar_url,
            onboarding_completed_at,
            date_of_birth,
            is_minor,
            show_age,
            gender,
            relationship_status,
            mood,
            appear_offline,
            hide_distance,
            hide_minors,
            only_verified,
            strict_mutual_interests,
            quiet_hours_start,
            quiet_hours_end,
            default_plan_expires_minutes,
            default_desired_group_size,
            default_desired_gender
          FROM user_profiles
          WHERE user_id = ${userId}
          LIMIT 1
        `,
        sql`
          SELECT interest
          FROM user_interests
          WHERE user_id = ${userId}
          ORDER BY interest ASC
          LIMIT 50
        `,
        sql`
          SELECT id, url, sort_order
          FROM profile_photos
          WHERE user_id = ${userId}
          ORDER BY sort_order ASC
          LIMIT 10
        `,
      ]);

    const user = userRows?.[0] || null;
    const profile = profileRows?.[0] || null;

    const interests = (interestRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean);

    const photos = (photoRows || []).map((p) => ({
      id: p.id,
      url: p.url,
      sortOrder: p.sort_order,
    }));

    const onboardingCompleted =
      !!profile?.onboarding_completed_at && !!profile?.date_of_birth;

    return Response.json(
      {
        ok: true,
        tier,
        user: {
          id: user?.id || userId,
          email: user?.email || session?.user?.email || "",
          name: user?.name || session?.user?.name || "",
          image: user?.image || "",
          emailVerified: user?.emailVerified || null,
        },
        onboarding: {
          completed: onboardingCompleted,
        },
        profile: profile
          ? {
              displayName: profile.display_name || "",
              bio: profile.bio || "",
              city: profile.city || "",
              state: profile.state || "",
              avatarUrl: profile.avatar_url || "",
              dateOfBirth: toIsoDateOnly(profile.date_of_birth),
              isMinor: !!profile.is_minor,
              showAge: !!profile.show_age,
              gender: profile.gender || "",
              relationshipStatus: profile.relationship_status || "",
              mood: profile.mood || "",
              appearOffline: !!profile.appear_offline,
              hideDistance: !!profile.hide_distance,
              discoveryPrefs: {
                hideMinors: !!profile.hide_minors,
                onlyVerified: !!profile.only_verified,
                strictMutualInterests: !!profile.strict_mutual_interests,
              },
              quietHours: {
                start: Number(profile.quiet_hours_start),
                end: Number(profile.quiet_hours_end),
              },
              planDefaults: {
                expiresMinutes: Number(profile.default_plan_expires_minutes),
                desiredGroupSize:
                  profile.default_desired_group_size === null
                    ? null
                    : Number(profile.default_desired_group_size),
                desiredGender: profile.default_desired_gender || "any",
              },
            }
          : null,
        interests,
        photos,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/me error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
