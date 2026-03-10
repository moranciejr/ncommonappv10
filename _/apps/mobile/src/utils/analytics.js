import { Platform } from "react-native";
import authedFetch from "@/utils/authedFetch";

function safeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

export async function trackEvent(name, properties) {
  const safeName = typeof name === "string" ? name.trim().slice(0, 64) : "";
  if (!safeName) {
    return;
  }

  try {
    // NOTE: We are collecting first-party analytics only (no cross-app tracking).
    // Do not gate on ATT / tracking permission.
    await authedFetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: safeName,
        platform: Platform.OS,
        properties: safeObject(properties),
      }),
    });
  } catch (_err) {
    // analytics should never block UX
  }
}

export async function trackCrash(error, context) {
  try {
    const message =
      typeof error?.message === "string" ? error.message.slice(0, 2000) : "";
    const stack = typeof error?.stack === "string" ? error.stack : "";

    await authedFetch("/api/analytics/crash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: Platform.OS,
        message,
        stack,
        context: safeObject(context),
      }),
    });
  } catch (_err) {
    // never throw from crash reporting
  }
}
