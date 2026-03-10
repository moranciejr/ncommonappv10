import sql from "@/app/api/utils/sql";
import { requireOnboardedUser } from "@/app/api/utils/require-user";

const DEMO_EMAIL_DOMAIN = "ncommon.local";

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function titleCase(value) {
  const s = String(value || "").trim();
  if (!s) {
    return "";
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isoMinutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function dateOnlyYearsAgo(yearsAgo) {
  const now = new Date();
  const year = now.getUTCFullYear() - yearsAgo;
  const month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), 28); // avoid invalid dates
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().slice(0, 10);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    // Keep this endpoint strictly non-production.
    // In production, it should behave like it does not exist.
    const isProd =
      process.env.ENV === "production" || process.env.NODE_ENV === "production";

    if (isProd) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const gate = await requireOnboardedUser(sql, request);
    if (gate.error) {
      return Response.json({ error: gate.error }, { status: gate.status });
    }

    const { userId } = gate;

    const baseLat = clampNum(body?.lat, {
      min: -90,
      max: 90,
      fallback: 30.2672, // Austin
    });

    const baseLng = clampNum(body?.lng, {
      min: -180,
      max: 180,
      fallback: -97.7431,
    });

    const city =
      typeof body?.city === "string" ? body.city.slice(0, 120) : "Austin";
    const state =
      typeof body?.state === "string" ? body.state.slice(0, 120) : "TX";

    const count = clampNum(body?.count, { min: 6, max: 30, fallback: 14 });

    // Use the current user's interests so the map lights up immediately.
    const myInterestRows = await sql(
      "SELECT interest FROM user_interests WHERE user_id = $1 ORDER BY interest",
      [userId],
    );

    const myInterests = (myInterestRows || [])
      .map((r) => (r?.interest ? String(r.interest) : ""))
      .filter(Boolean)
      .slice(0, 25);

    // IMPORTANT: Keep demo interests aligned with the in-app taxonomy values (lowercase).
    // This avoids a mismatch like "yoga" vs "yoga / pilates".
    const interestsPool = [
      ...new Set(
        [
          ...myInterests,
          "museum & gallery visits",
          "painting / drawing",
          "board games",
          "trivia nights",
          "gym workouts",
          "yoga / pilates",
          "meditation / mindfulness",
          "craft beer",
          "restaurant hopping",
          "sushi",
          "wine tasting",
          "coding meetups",
          "language exchange",
          "dj / dance nights",
          "karaoke",
          "live concerts",
          "bar hopping",
          "sports bar",
          "hiking / backpacking",
          "cycling",
          "pickleball",
          "bowling",
          "dog walking & park meetups",
          "community clean-ups",
        ].map((x) => String(x).trim().toLowerCase()),
      ),
    ].filter(Boolean);

    const places = [
      { name: "Museum", interest: "museum & gallery visits" },
      { name: "Art studio", interest: "painting / drawing" },
      { name: "Board game cafe", interest: "board games" },
      { name: "Trivia night", interest: "trivia nights" },
      { name: "Gym", interest: "gym workouts" },
      { name: "Yoga studio", interest: "yoga / pilates" },
      { name: "Meditation spot", interest: "meditation / mindfulness" },
      { name: "Craft beer bar", interest: "craft beer" },
      { name: "Sushi place", interest: "sushi" },
      { name: "Restaurant strip", interest: "restaurant hopping" },
      { name: "Wine bar", interest: "wine tasting" },
      { name: "Coding meetup", interest: "coding meetups" },
      { name: "Language exchange", interest: "language exchange" },
      { name: "DJ night", interest: "dj / dance nights" },
      { name: "Karaoke bar", interest: "karaoke" },
      { name: "Live music", interest: "live concerts" },
      { name: "Bar strip", interest: "bar hopping" },
      { name: "Sports bar", interest: "sports bar" },
      { name: "Trailhead", interest: "hiking / backpacking" },
      { name: "Cycling route", interest: "cycling" },
      { name: "Pickleball courts", interest: "pickleball" },
      { name: "Bowling alley", interest: "bowling" },
      { name: "Dog park", interest: "dog walking & park meetups" },
      { name: "Park cleanup", interest: "community clean-ups" },
    ];

    const placeForInterest = (interest) => {
      const found = places.find((p) => p.interest === interest);
      if (found) {
        return found;
      }
      return { name: `${titleCase(interest)} spot`, interest };
    };

    const names = [
      "Ava",
      "Noah",
      "Mia",
      "Leo",
      "Sofia",
      "Ivy",
      "Zoe",
      "Ethan",
      "Kai",
      "Luca",
      "Amelia",
      "Nora",
      "Jules",
      "Rowan",
      "Sam",
      "Aria",
      "Theo",
      "Hazel",
      "Finn",
      "Elena",
    ];

    const bios = [
      "Always down for a quick coffee and a walk.",
      "Trying new places around town and meeting chill people.",
      "Gym + good food + great conversations.",
      "I’m here for concerts, art, and late-night tacos.",
      "Book stores, hikes, and anything outdoors.",
      "Looking for people to try new classes with.",
      "If you like brunch, we’ll get along.",
    ];

    const avatarUrls = [
      "https://ucarecdn.com/18a14f6c-4be3-41dc-8f2b-01f8b9c1d48f/-/format/auto/",
      "https://ucarecdn.com/2d7d2237-82d6-41c0-92d8-aecb8e9d8a4e/-/format/auto/",
      "https://ucarecdn.com/7c9d30fe-8ab7-4e3b-a4d6-3cfcb7f4a8d5/-/format/auto/",
      "https://ucarecdn.com/df2ec4a6-0c73-4dc5-8fbb-4df8a1b6c63a/-/format/auto/",
      "https://ucarecdn.com/1d5cc2f4-a0d0-4e34-8991-260c3f7428f6/-/format/auto/",
      "https://ucarecdn.com/df0d4d78-f1d8-4b2a-86c5-79e6076c7f0b/-/format/auto/",
    ];

    // Remove any previous demo accounts.
    const demoRows = await sql(
      "SELECT id FROM auth_users WHERE email LIKE $1",
      [`demo_%@${DEMO_EMAIL_DOMAIN}`],
    );

    const demoIds = (demoRows || []).map((r) => r.id).filter(Boolean);
    if (demoIds.length) {
      await sql("DELETE FROM auth_users WHERE id = ANY($1::int[])", [demoIds]);
    }

    const created = [];
    let createdEvents = 0;

    for (let i = 0; i < count; i += 1) {
      const displayName = `${names[i % names.length]} ${String.fromCharCode(65 + (i % 26))}.`;
      const email = `demo_${i}@${DEMO_EMAIL_DOMAIN}`;
      const bio = bios[i % bios.length];
      const avatarUrl = avatarUrls[i % avatarUrls.length];

      const [userRow] = await sql(
        'INSERT INTO auth_users (name, email, "emailVerified") VALUES ($1, $2, NOW()) RETURNING id',
        [displayName, email],
      );

      const demoUserId = userRow?.id;
      if (!demoUserId) {
        continue;
      }

      const age = 16 + (i % 17); // 16..32
      const dateOfBirth = dateOnlyYearsAgo(age);
      const isMinor = age < 18;
      const showAge = false;

      await sql(
        `
        INSERT INTO user_profiles (
          user_id,
          display_name,
          bio,
          city,
          state,
          avatar_url,
          date_of_birth,
          is_minor,
          show_age,
          onboarding_completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          avatar_url = EXCLUDED.avatar_url,
          date_of_birth = EXCLUDED.date_of_birth,
          is_minor = EXCLUDED.is_minor,
          show_age = EXCLUDED.show_age,
          onboarding_completed_at = EXCLUDED.onboarding_completed_at,
          updated_at = NOW()
        `,
        [
          demoUserId,
          displayName,
          bio,
          city,
          state,
          avatarUrl,
          dateOfBirth,
          isMinor,
          showAge,
        ],
      );

      // Guarantee at least one interest overlaps with the current user (so Discover + Map work immediately).
      const guaranteed = myInterests.length
        ? myInterests[i % myInterests.length]
        : interestsPool[i % interestsPool.length];

      const pickedInterests = [
        guaranteed,
        ...pickN(
          interestsPool.filter((x) => x !== guaranteed),
          2 + (i % 2),
        ),
      ].filter(Boolean);

      for (const it of pickedInterests) {
        await sql(
          "INSERT INTO user_interests (user_id, interest) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [demoUserId, it],
        );
      }

      // Make their check-in match the overlapping interest if possible.
      const checkinInterest = guaranteed;
      const place = placeForInterest(checkinInterest);

      const jitterLat = baseLat + (Math.random() - 0.5) * 0.06;
      const jitterLng = baseLng + (Math.random() - 0.5) * 0.06;
      const expiresAt = new Date(
        Date.now() + (30 + Math.floor(Math.random() * 90)) * 60 * 1000,
      );

      await sql(
        `
        INSERT INTO checkins (user_id, location_name, note, lat, lng, interest, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          demoUserId,
          place.name,
          "Down to meet people who share this interest.",
          jitterLat,
          jitterLng,
          place.interest,
          expiresAt.toISOString(),
        ],
      );

      // Seed some events so the map has "happening now" + "upcoming" pins.
      // Roughly ~1/3 of users will have an event.
      if (i % 3 === 0) {
        const startsAt =
          i % 6 === 0 ? isoMinutesFromNow(-30) : isoMinutesFromNow(120 + i * 6);
        const endsAt = i % 6 === 0 ? isoMinutesFromNow(90) : null;

        const eventTitle =
          i % 6 === 0
            ? `${titleCase(place.interest)} meetup (now)`
            : `${titleCase(place.interest)} meetup`;

        const [eventRow] = await sql(
          `
          INSERT INTO events (
            creator_user_id,
            title,
            location_name,
            city,
            state,
            interest,
            lat,
            lng,
            starts_at,
            ends_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING id
          `,
          [
            demoUserId,
            eventTitle,
            place.name,
            city,
            state,
            place.interest,
            jitterLat,
            jitterLng,
            startsAt,
            endsAt,
          ],
        );

        const eventId = eventRow?.id;
        if (eventId) {
          createdEvents += 1;
          await sql(
            "INSERT INTO event_attendees (event_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            [eventId, demoUserId],
          );
        }
      }

      created.push({
        userId: demoUserId,
        displayName,
        interest: place.interest,
      });
    }

    return Response.json(
      {
        ok: true,
        createdCount: created.length,
        createdEventCount: createdEvents,
        myInterestsUsed: myInterests,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/dev/seed-demo error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
