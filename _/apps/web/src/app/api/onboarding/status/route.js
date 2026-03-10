import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/require-user";

function computeAgeFromIsoDateOnly(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) {
    return null;
  }
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth() + 1;
  const da = now.getUTCDate();

  let age = y - year;
  if (mo < month || (mo === month && da < day)) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 130) {
    return null;
  }
  return age;
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

    const [userRows, profileRows, interestRows] = await sql.transaction([
      sql`
        SELECT id, email, name, "emailVerified"
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
          appear_offline,
          hide_distance
        FROM user_profiles
        WHERE user_id = ${userId}
        LIMIT 1
      `,
      sql`
        SELECT interest
        FROM user_interests
        WHERE user_id = ${userId}
        ORDER BY interest ASC
      `,
    ]);

    const user = userRows?.[0] || null;
    const profile = profileRows?.[0] || null;
    const interests = (interestRows || []).map((r) => r.interest);

    // --- NEW: hard 18+ enforcement bookkeeping ---
    // If a DOB exists and indicates <18, mark the profile as minor.
    // (This keeps the mobile app from getting stuck in confusing 403 loops.)
    let isMinor = !!profile?.is_minor;
    const dobIso = profile?.date_of_birth ? String(profile.date_of_birth) : "";

    if (dobIso && !isMinor) {
      const age = computeAgeFromIsoDateOnly(dobIso);
      if (age !== null && age < 18) {
        isMinor = true;
        try {
          await sql`
            UPDATE user_profiles
            SET is_minor = true, updated_at = NOW()
            WHERE user_id = ${userId}
          `;
        } catch (err) {
          console.error("Failed to mark user as minor", err);
        }
      }
    }

    const onboardingCompleted =
      !!profile?.onboarding_completed_at && !!profile?.date_of_birth;

    return Response.json(
      {
        ok: true,
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          emailVerified: user?.emailVerified || null,
        },
        onboarding: {
          completed: onboardingCompleted,
          profile: profile
            ? {
                displayName: profile.display_name || "",
                bio: profile.bio || "",
                city: profile.city || "",
                state: profile.state || "",
                avatarUrl: profile.avatar_url || "",
                dateOfBirth: profile.date_of_birth
                  ? String(profile.date_of_birth)
                  : "",
                isMinor,
                showAge: !!profile.show_age,
                // NEW: settings-backed privacy fields
                appearOffline: !!profile.appear_offline,
                hideDistance: !!profile.hide_distance,
              }
            : {
                displayName: "",
                bio: "",
                city: "",
                state: "",
                avatarUrl: "",
                dateOfBirth: "",
                isMinor: false,
                showAge: false,
                appearOffline: false,
                hideDistance: false,
              },
          interests,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/onboarding/status error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
