import sql from "@/app/api/utils/sql";

function toInt(value) {
  const n =
    typeof value === "number" ? value : parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function cleanText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const cap =
    typeof maxLen === "number" && Number.isFinite(maxLen) ? maxLen : 140;
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}

function hourUtcNow() {
  const d = new Date();
  return d.getUTCHours();
}

function isQuietHoursActive(startHour, endHour, nowHour) {
  const s = Number.isFinite(startHour) ? startHour : 22;
  const e = Number.isFinite(endHour) ? endHour : 8;
  const h = Number.isFinite(nowHour) ? nowHour : hourUtcNow();

  // If start == end, treat as "no quiet hours".
  if (s === e) {
    return false;
  }

  // Normal range (e.g. 9 -> 17)
  if (s < e) {
    return h >= s && h < e;
  }

  // Wrap-around range (e.g. 22 -> 8)
  return h >= s || h < e;
}

function prefsAllowType(prefs, type) {
  if (type === "message") {
    return prefs.notif_messages !== false;
  }
  if (type === "checkin_request") {
    return prefs.notif_join_requests !== false;
  }
  if (type === "checkin_request_update") {
    return prefs.notif_request_updates !== false;
  }
  if (type === "nearby_plan_starting_soon") {
    return prefs.notif_nearby_plans !== false;
  }
  // Default to allow for unknown types.
  return true;
}

async function getPrefs(userId) {
  const rows = await sql(
    `
    SELECT
      notif_messages,
      notif_join_requests,
      notif_request_updates,
      notif_nearby_plans,
      quiet_hours_start,
      quiet_hours_end
    FROM public.user_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  );

  const r = rows?.[0] || {};

  return {
    notif_messages: r.notif_messages !== false,
    notif_join_requests: r.notif_join_requests !== false,
    notif_request_updates: r.notif_request_updates !== false,
    notif_nearby_plans: r.notif_nearby_plans !== false,
    quiet_hours_start: Number.isFinite(r.quiet_hours_start)
      ? Number(r.quiet_hours_start)
      : 22,
    quiet_hours_end: Number.isFinite(r.quiet_hours_end)
      ? Number(r.quiet_hours_end)
      : 8,
  };
}

async function listActiveTokens(userId) {
  const rows = await sql(
    `
    SELECT token
    FROM public.push_tokens
    WHERE user_id = $1
      AND disabled_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 20
    `,
    [userId],
  );

  return (rows || [])
    .map((r) => (r?.token ? String(r.token) : ""))
    .filter(Boolean);
}

async function disableTokens(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return;
  }

  // Build: WHERE token IN ($1,$2,...)
  const values = tokens.slice(0, 200);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

  await sql(
    `
    UPDATE public.push_tokens
    SET disabled_at = NOW(), updated_at = NOW()
    WHERE token IN (${placeholders})
    `,
    values,
  );
}

async function postToExpo(messages) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : response.statusText || "Expo push request failed";
    const err = new Error(
      `When posting to Expo push API, the response was [${response.status}] ${msg}`,
    );
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
}

async function sendExpoPushInternal(
  { userId, type, title, body, data } = {},
  { bypassPrefs = false, bypassQuietHours = false } = {},
) {
  const targetUserId = toInt(userId);
  if (!targetUserId) {
    return { ok: false, sent: 0, reason: "invalid_user" };
  }

  const prefs = await getPrefs(targetUserId);

  if (!bypassPrefs) {
    if (!prefsAllowType(prefs, type)) {
      return { ok: true, sent: 0, reason: "toggle_off" };
    }
  }

  if (!bypassQuietHours) {
    if (isQuietHoursActive(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
      // Simplest: suppress (no queue)
      return { ok: true, sent: 0, reason: "quiet_hours" };
    }
  }

  const tokens = await listActiveTokens(targetUserId);
  if (!tokens.length) {
    return { ok: true, sent: 0, reason: "no_tokens" };
  }

  const safeTitle = cleanText(title, 80) || "nCommon";
  const safeBody = cleanText(body, 180);

  const messages = tokens.map((t) => ({
    to: t,
    title: safeTitle,
    body: safeBody,
    sound: "default",
    data: data && typeof data === "object" ? data : {},
  }));

  const expoResponse = await postToExpo(messages);

  const results = Array.isArray(expoResponse?.data) ? expoResponse.data : [];

  const badTokens = [];
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    const status = typeof r?.status === "string" ? r.status : "";
    if (status === "error") {
      const details = r?.details || {};
      const errCode = typeof details?.error === "string" ? details.error : "";

      if (
        errCode === "DeviceNotRegistered" ||
        errCode === "InvalidCredentials"
      ) {
        badTokens.push(tokens[i]);
      }

      // Some failures come back without details.error.
      const messageText = typeof r?.message === "string" ? r.message : "";
      if (messageText.toLowerCase().includes("not registered")) {
        badTokens.push(tokens[i]);
      }
    }
  }

  if (badTokens.length) {
    try {
      await disableTokens([...new Set(badTokens)]);
    } catch (err) {
      console.error("Failed disabling bad push tokens", err);
    }
  }

  const sentOk = results.filter((r) => r?.status === "ok").length;
  return { ok: true, sent: sentOk, resultsCount: results.length };
}

export async function sendExpoPush({ userId, type, title, body, data } = {}) {
  // IMPORTANT: This exported sender always respects user prefs + quiet hours.
  // Debug bypass is only available via sendExpoPushDebug (used by /api/push/test).
  return sendExpoPushInternal(
    {
      userId,
      type,
      title,
      body,
      data,
    },
    {
      bypassPrefs: false,
      bypassQuietHours: false,
    },
  );
}

// Debug-only sender. Do not use this for product pushes.
export async function sendExpoPushDebug(
  { userId, type, title, body, data } = {},
  { bypassPrefs = false, bypassQuietHours = false } = {},
) {
  return sendExpoPushInternal(
    {
      userId,
      type,
      title,
      body,
      data,
    },
    {
      bypassPrefs: bypassPrefs === true,
      bypassQuietHours: bypassQuietHours === true,
    },
  );
}

// NEW: ergonomic wrapper used by API routes.
// Signature requested: sendPushToUser(userId, { title, body, data })
export async function sendPushToUser(userId, { title, body, data } = {}) {
  const payload = data && typeof data === "object" ? data : {};
  const derivedType =
    typeof payload.type === "string" && payload.type.trim()
      ? payload.type.trim()
      : "generic";

  return sendExpoPush({
    userId,
    type: derivedType,
    title,
    body,
    data: payload,
  });
}

export default sendExpoPush;
