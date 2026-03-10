import { requireUser } from "@/app/api/utils/require-user";
import { consumeRateLimit } from "@/app/api/utils/rate-limit";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  const gate = await requireUser(request);
  if (!gate?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 uploads per hour, 60 per day
  const okHour = await consumeRateLimit(sql, {
    userId: gate.userId,
    action: "uploads_per_hour",
    windowSeconds: 60 * 60,
    limit: 20,
  });
  const okDay = await consumeRateLimit(sql, {
    userId: gate.userId,
    action: "uploads_per_day",
    windowSeconds: 24 * 60 * 60,
    limit: 60,
  });
  if (!okHour || !okDay) {
    return Response.json(
      { error: "Too many uploads. Please try again later." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("/api/upload invalid JSON", err);
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const base64 = typeof body?.base64 === "string" ? body.base64 : null;
  const url = typeof body?.url === "string" ? body.url : null;

  if (!base64 && !url) {
    return Response.json({ error: "Missing base64 or url" }, { status: 400 });
  }

  // Basic size guard. Anything's backend request body limit is ~4.5MB.
  // Base64 is larger than binary; keep it conservative.
  if (base64 && base64.length > 4_000_000) {
    return Response.json(
      { error: "Upload failed: File too large." },
      { status: 413 },
    );
  }

  try {
    // IMPORTANT:
    // In Expo/iOS we saw the most reliable path is to leverage Anything's built-in
    // uploader endpoint, but still keep our own auth gate + consistent API.
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new Error("Server misconfigured: APP_URL is missing");
    }

    const upstreamPayload = {
      ...(base64 ? { base64 } : {}),
      ...(url ? { url } : {}),
    };

    const upstream = await fetch(`${appUrl}/_create/api/upload/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamPayload),
    });

    const upstreamData = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg =
        upstreamData?.error ||
        upstreamData?.message ||
        `Upload failed (${upstream.status} ${upstream.statusText})`;
      const status = upstream.status === 413 ? 413 : 500;
      return Response.json({ error: msg }, { status });
    }

    if (!upstreamData?.url) {
      return Response.json(
        { error: "Upload failed: no URL returned" },
        { status: 500 },
      );
    }

    return Response.json({
      url: upstreamData.url,
      mimeType: upstreamData.mimeType || null,
    });
  } catch (err) {
    console.error("/api/upload failed", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to upload image.";

    const status = message.toLowerCase().includes("too large") ? 413 : 500;
    return Response.json({ error: message }, { status });
  }
}
