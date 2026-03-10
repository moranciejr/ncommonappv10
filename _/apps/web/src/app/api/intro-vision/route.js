/**
 * /api/intro-vision
 *
 * This endpoint uses GPT Vision to critique intro/onboarding slide screenshots.
 *
 * NOTE: Currently unused in the mobile app. Kept for development and design review.
 * Can be used to analyze screenshots during development.
 *
 * Usage: POST /api/intro-vision with { imageUrl: "..." }
 */

function getBaseUrl() {
  const base = process.env.APP_URL || process.env.AUTH_URL;
  if (base) {
    return base;
  }
  return "http://localhost:3000";
}

function detectMimeType(url, response) {
  const ct = response?.headers?.get?.("content-type");
  if (ct && ct.includes("image/")) {
    return ct.split(";")[0];
  }
  const lower = String(url || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = body?.imageUrl;

    if (!imageUrl || typeof imageUrl !== "string") {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const imageResponse = await fetch(imageUrl, { method: "GET" });
    if (!imageResponse.ok) {
      throw new Error(
        `Could not download image. Response was [${imageResponse.status}] ${imageResponse.statusText}`,
      );
    }

    const mimeType = detectMimeType(imageUrl, imageResponse);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const baseUrl = getBaseUrl();
    const visionUrl = new URL("/integrations/gpt-vision/", baseUrl);

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Critique this onboarding slide screenshot for a friends-first social map app. Call out: alignment issues, truncation/cropping, readability, and what would make it feel more premium.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ];

    const response = await fetch(visionUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || response.statusText;
      throw new Error(
        `When fetching ${visionUrl.pathname}, the response was [${response.status}] ${msg}`,
      );
    }

    const content = data?.choices?.[0]?.message?.content;

    return Response.json({ content, raw: data });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not analyze image" }, { status: 500 });
  }
}
