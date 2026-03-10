export async function POST(request) {
  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      return Response.json(
        {
          success: false,
          error: "Turnstile is not configured.",
        },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : null;

    if (!token) {
      return Response.json(
        { success: false, error: "Missing token." },
        { status: 400 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const remoteip = forwardedFor.split(",")[0]?.trim() || undefined;

    const form = new URLSearchParams();
    form.set("secret", secretKey);
    form.set("response", token);
    if (remoteip) {
      form.set("remoteip", remoteip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: "Turnstile verification failed.",
          details: data,
        },
        { status: 502 },
      );
    }

    const success = !!data?.success;

    return Response.json({ success, details: data });
  } catch (err) {
    console.error("Turnstile verify error", err);
    return Response.json(
      { success: false, error: "Unexpected error." },
      { status: 500 },
    );
  }
}
