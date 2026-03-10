/**
 * /api/intro-art
 *
 * This endpoint generates DALL-E artwork for intro/onboarding slides.
 *
 * NOTE: Currently unused in the mobile app. The intro screen uses hardcoded images.
 * This endpoint is kept for potential future use or development tooling.
 *
 * Usage: GET /api/intro-art?v=3&refresh=1
 */

let cached = null;
let cachedAt = 0;
let cachedVersion = null;

const DEFAULT_VERSION = "3";

function getBaseUrl() {
  const base = process.env.APP_URL || process.env.AUTH_URL;
  if (base) {
    return base;
  }
  return "http://localhost:3000";
}

async function generateOne({ key, prompt }) {
  const baseUrl = getBaseUrl();
  const url = new URL("/integrations/dall-e-3/", baseUrl);
  url.searchParams.set("prompt", prompt);

  const response = await fetch(url.toString(), { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data?.error || response.statusText;
    throw new Error(
      `When fetching ${url.pathname}, the response was [${response.status}] ${msg}`,
    );
  }

  const imageUrl = data?.data?.[0];
  if (!imageUrl) {
    throw new Error("DALL·E 3 returned no image URL");
  }

  return { key, url: imageUrl };
}

export async function GET(request) {
  try {
    const urlObj = new URL(request.url);
    const requestedVersion = urlObj.searchParams.get("v") || DEFAULT_VERSION;
    const forceRefresh = urlObj.searchParams.get("refresh") === "1";

    // cache for 30 days (enough for dev + avoids repeated generation)
    const thirtyDays = 1000 * 60 * 60 * 24 * 30;
    const now = Date.now();
    const cacheValid =
      cached &&
      cachedAt &&
      now - cachedAt < thirtyDays &&
      cachedVersion === requestedVersion;

    if (cacheValid && !forceRefresh) {
      return Response.json({
        art: cached,
        cached: true,
        version: cachedVersion,
      });
    }

    const prompts = [
      {
        key: "friends",
        prompt:
          "Flat vector illustration, premium iOS onboarding style. Three diverse friends meeting casually at a coffee shop / park (clearly friends, not romantic). One person holds a phone showing a map pin (no readable text). Warm, welcoming, modern minimal, soft pastel gradient background, rounded shapes, lots of white space, high quality, no words, no letters.",
      },
      {
        key: "interests",
        prompt:
          "Flat vector illustration, premium iOS onboarding style. A phone screen with colorful interest chips (no readable text) and simple hobby icons (coffee cup, dumbbell, music note, book, hiking). Modern minimal, soft pastel gradient, rounded shapes, lots of white space, no words, no letters.",
      },
      {
        key: "map",
        prompt:
          "Flat vector illustration, premium iOS onboarding style. A friendly city map with a few location pins and one simple card preview (no readable text). Emphasize 'nearby' and 'easy'. Modern minimal, soft pastel gradient, rounded shapes, no words, no letters.",
      },
      {
        key: "plan",
        prompt:
          "Flat vector illustration, premium iOS onboarding style. Creating a simple meetup plan card (time + place shown as icons only, no readable text) with a friendly button. Modern minimal, soft pastel gradient, rounded shapes, no words, no letters.",
      },
      {
        key: "safety",
        prompt:
          "Flat vector illustration, premium iOS onboarding style. Safety + privacy controls: shield icon, toggles, and a 'block' style icon, but no readable text. Reassuring, modern minimal, soft pastel gradient, rounded shapes, no words, no letters.",
      },
    ];

    const art = {};
    for (const p of prompts) {
      const result = await generateOne(p);
      art[result.key] = result.url;
    }

    cached = art;
    cachedAt = now;
    cachedVersion = requestedVersion;

    return Response.json({ art, cached: false, version: cachedVersion });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not generate intro art" },
      { status: 500 },
    );
  }
}
