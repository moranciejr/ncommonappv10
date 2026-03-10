import { requireUser } from "@/app/api/utils/require-user";
import sql from "@/app/api/utils/sql";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";

function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

function cleanInput(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 120);
}

export async function GET(request) {
  try {
    const { userId } = await requireUser(request);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit Google Places calls — each call costs money (120/hour per user)
    const ok = await consumeRateLimit(sql, {
      userId,
      action: "places_autocomplete_per_hour",
      windowSeconds: 60 * 60,
      limit: 120,
    });
    if (!ok) {
      return Response.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 },
      );
    }

    const url = new URL(request.url);

    const input = cleanInput(url.searchParams.get("input"));
    if (!input) {
      return Response.json({ ok: true, predictions: [] }, { status: 200 });
    }

    const lat = clampNum(url.searchParams.get("lat"), {
      min: -90,
      max: 90,
      fallback: null,
    });

    const lng = clampNum(url.searchParams.get("lng"), {
      min: -180,
      max: 180,
      fallback: null,
    });

    const radiusMeters = clampNum(url.searchParams.get("radiusMeters"), {
      min: 50,
      max: 50000,
      fallback: 805, // ~0.5 miles
    });

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Google Maps API key is not configured" },
        { status: 500 },
      );
    }

    const params = new URLSearchParams();
    params.set("input", input);
    params.set("key", apiKey);
    params.set("radius", String(Math.round(radiusMeters)));

    // Bias results near the user when we have coordinates.
    if (typeof lat === "number" && typeof lng === "number") {
      params.set("location", `${lat},${lng}`);
    }

    // Prefer real venues for check-ins.
    params.set("types", "establishment");

    const upstreamUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    const response = await fetch(upstreamUrl, { method: "GET" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(
        {
          error: `Google Places error: ${response.status} ${response.statusText}`,
        },
        { status: 502 },
      );
    }

    const upstreamStatus = String(data?.status || "");

    if (
      upstreamStatus &&
      upstreamStatus !== "OK" &&
      upstreamStatus !== "ZERO_RESULTS"
    ) {
      const msg = data?.error_message || upstreamStatus;
      return Response.json(
        { error: `Google Places error: ${msg}` },
        { status: 502 },
      );
    }

    const predictionsRaw = Array.isArray(data?.predictions)
      ? data.predictions
      : [];

    const predictions = predictionsRaw
      .slice(0, 12)
      .map((p) => {
        const mainText = p?.structured_formatting?.main_text || "";
        const secondaryText = p?.structured_formatting?.secondary_text || "";
        return {
          placeId: p?.place_id || "",
          description: p?.description || "",
          mainText,
          secondaryText,
          types: Array.isArray(p?.types) ? p.types : [],
        };
      })
      .filter((p) => p.placeId);

    return Response.json(
      {
        ok: true,
        predictions,
        status: upstreamStatus,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/places/autocomplete error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
