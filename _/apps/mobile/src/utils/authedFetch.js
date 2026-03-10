import { useAuthStore } from "@/utils/auth/store";

/**
 * Mobile helper: automatically includes the user's JWT (if present) for /api requests.
 *
 * This is critical for standalone builds, where NextAuth cookies are not shared with
 * React Native fetch calls.
 */
export async function authedFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url;

  const state = useAuthStore.getState?.();
  const jwt = state?.auth?.jwt;

  const headers = {
    ...(init.headers || {}),
  };

  // Only attach auth for our API routes.
  if (jwt && typeof url === "string" && url.startsWith("/api/")) {
    // Don't overwrite if caller explicitly set Authorization.
    if (!headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${jwt}`;
    }
  }

  // Allow callers to override timeouts (uploads, long requests). Default is meant to
  // prevent "spinner forever" when the server is slow/unreachable.
  const { timeoutMs, ...restInit } = init || {};
  const safeTimeoutMs =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs)
      ? Math.max(0, timeoutMs)
      : 15000;

  const canAbort = typeof AbortController !== "undefined";
  const controller = canAbort ? new AbortController() : null;
  const shouldAttachSignal = !!controller && !restInit.signal;

  let timeoutId = null;
  if (controller && safeTimeoutMs > 0) {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch (_) {
        // ignore
      }
    }, safeTimeoutMs);
  }

  let response;
  try {
    response = await fetch(input, {
      ...restInit,
      headers,
      ...(shouldAttachSignal ? { signal: controller.signal } : {}),
    });
  } catch (err) {
    // Normalize slow/offline failures so screens can show a nice message.
    const name = typeof err?.name === "string" ? err.name : "";

    if (name === "AbortError") {
      const e = new Error("Request timed out");
      e.code = "TIMEOUT";
      e.cause = err;
      throw e;
    }

    const e = new Error("Network request failed");
    e.code = "NETWORK_ERROR";
    e.cause = err;
    throw e;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

  // If the server says we're unauthorized, clear local auth so the app can recover
  // (e.g. token revoked/expired) instead of getting stuck in failing requests.
  if (response.status === 401 && jwt) {
    try {
      const store = useAuthStore.getState?.();
      if (store?.setAuth) {
        store.setAuth(null);
      } else {
        useAuthStore.setState?.({ auth: null });
      }
    } catch (err) {
      console.error(err);
    }
  }

  return response;
}

export default authedFetch;
