import { requireUser } from "@/app/api/utils/require-user";

function cleanPlaceId(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, 256);
}

export async function GET(request) {
  try {
    const { userId } = await requireUser(request);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const placeId = cleanPlaceId(url.searchParams.get("placeId"));

    if (!placeId) {
      return Response.json({ error: "placeId is required" }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Google Maps API key is not configured" },
        { status: 500 },
      );
    }

    const params = new URLSearchParams();
    params.set("place_id", placeId);
    params.set("key", apiKey);
    params.set("fields", "name,geometry,formatted_address");

    const upstreamUrl = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

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
    if (upstreamStatus && upstreamStatus !== "OK") {
      const msg = data?.error_message || upstreamStatus;
      return Response.json(
        { error: `Google Places error: ${msg}` },
        { status: 502 },
      );
    }

    const result = data?.result || {};

    const name = typeof result?.name === "string" ? result.name : "";
    const formattedAddress =
      typeof result?.formatted_address === "string"
        ? result.formatted_address
        : "";

    const latRaw = result?.geometry?.location?.lat;
    const lngRaw = result?.geometry?.location?.lng;

    const lat = typeof latRaw === "number" ? latRaw : null;
    const lng = typeof lngRaw === "number" ? lngRaw : null;

    return Response.json(
      {
        ok: true,
        place: {
          placeId,
          name,
          formattedAddress,
          lat,
          lng,
        },
        status: upstreamStatus,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/places/details error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
