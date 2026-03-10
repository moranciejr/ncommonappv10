let cached = null;
let cachedAt = 0;
let cachedVersion = null;

const DEFAULT_VERSION = "2";

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

    // cache for 30 days
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

    // We need a small, instantly recognizable set of icons for map pins.
    // These MUST be obvious at a glance (no abstract art).
    const prompts = [
      {
        key: "food",
        prompt:
          "Small flat vector sticker icon for a map pin: a plate with fork and knife. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "music",
        prompt:
          "Small flat vector sticker icon for a map pin: headphones with a music note. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "sports",
        prompt:
          "Small flat vector sticker icon for a map pin: a basketball (simple). Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "outdoors",
        prompt:
          "Small flat vector sticker icon for a map pin: mountains with a sun. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "games",
        prompt:
          "Small flat vector sticker icon for a map pin: a game controller. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "fitness",
        prompt:
          "Small flat vector sticker icon for a map pin: a dumbbell. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "learning",
        prompt:
          "Small flat vector sticker icon for a map pin: a graduation cap. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "arts",
        prompt:
          "Small flat vector sticker icon for a map pin: an artist palette with a paint brush. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "pets",
        prompt:
          "Small flat vector sticker icon for a map pin: a paw print. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "shopping",
        prompt:
          "Small flat vector sticker icon for a map pin: a shopping bag. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "volunteering",
        prompt:
          "Small flat vector sticker icon for a map pin: hands holding a heart. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
      {
        key: "other",
        prompt:
          "Small flat vector sticker icon for a map pin: a simple sparkle star. Centered, single object. High contrast. White background. Rounded iOS style. No text, no letters.",
      },
    ];

    const results = await Promise.all(prompts.map((p) => generateOne(p)));
    const art = {};
    for (const r of results) {
      art[r.key] = r.url;
    }

    cached = art;
    cachedAt = Date.now();
    cachedVersion = requestedVersion;

    return Response.json({ art, cached: false, version: cachedVersion });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Could not generate interest art" },
      { status: 500 },
    );
  }
}
