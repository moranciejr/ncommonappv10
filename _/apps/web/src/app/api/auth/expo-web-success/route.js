import { getToken } from "@auth/core/jwt";
import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const [token, jwt] = await Promise.all([
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
      raw: true,
    }),
    getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL.startsWith("https"),
    }),
  ]);

  if (!jwt) {
    return new Response(
      `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Sign in failed</title>
          <style>
            body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:0;padding:24px;background:#fff;color:#111}
            .box{max-width:520px;margin:0 auto;border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:18px}
            .title{font-size:18px;font-weight:800;margin:0 0 8px}
            .text{font-size:14px;font-weight:650;color:rgba(0,0,0,.65);line-height:1.5;margin:0}
          </style>
        </head>
        <body>
          <div class="box">
            <div class="title">Couldn’t sign you in</div>
            <p class="text">Please go back to the app and try again.</p>
          </div>

          <script>
            const msg = { type: 'AUTH_ERROR', error: 'Unauthorized' };
            try {
              window.parent && window.parent.postMessage && window.parent.postMessage(msg, '*');
            } catch (e) {}
            try {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
            } catch (e) {}
          </script>
        </body>
      </html>
      `,
      {
        status: 401,
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  }

  let emailVerified = null;
  try {
    const userIdRaw = jwt.sub;
    const userId =
      typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : null;
    if (userId && !Number.isNaN(userId)) {
      const rows = await sql`
        SELECT "emailVerified"
        FROM auth_users
        WHERE id = ${userId}
        LIMIT 1
      `;
      emailVerified = rows?.[0]?.emailVerified ?? null;
    }
  } catch (err) {
    console.error(
      "Failed to load emailVerified in /api/auth/expo-web-success",
      err,
    );
  }

  const message = {
    type: "AUTH_SUCCESS",
    jwt: token,
    user: {
      id: jwt.sub,
      email: jwt.email,
      name: jwt.name,
      emailVerified,
    },
  };

  return new Response(
    `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Signed in</title>
        <style>
          body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:0;padding:24px;background:#fff;color:#111}
          .box{max-width:520px;margin:0 auto;border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:18px}
          .title{font-size:18px;font-weight:800;margin:0 0 8px}
          .text{font-size:14px;font-weight:650;color:rgba(0,0,0,.65);line-height:1.5;margin:0}
        </style>
      </head>
      <body>
        <div class="box">
          <div class="title">You’re signed in</div>
          <p class="text">You can close this tab and return to the app.</p>
        </div>

        <script>
          const msg = ${JSON.stringify(message)};
          try {
            window.parent && window.parent.postMessage && window.parent.postMessage(msg, '*');
          } catch (e) {}
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          } catch (e) {}
        </script>
      </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
}
