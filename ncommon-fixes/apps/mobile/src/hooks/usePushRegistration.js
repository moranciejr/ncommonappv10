import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";
import { useMe } from "@/hooks/useMe";
import { trackEvent } from "@/utils/analytics";

const STORAGE_KEY = "push:lastRegisteredToken";

async function safeGetItem(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

async function safeSetItem(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (_err) {
    // ignore
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  } catch (err) {
    console.error("Failed to set Android notification channel", err);
  }
}

async function getExpoPushToken() {
  const perm = await Notifications.getPermissionsAsync();
  let status = perm?.status;

  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req?.status;
  }

  if (status !== "granted") {
    return { token: null, status };
  }

  // Some builds require projectId; keep it best-effort.
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null;

  const resp = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = resp?.data ? String(resp.data) : null;
  return { token, status: "granted" };
}

async function registerWithBackend({ token, platform }) {
  const response = await authedFetch("/api/push/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform }),
  });

  const data = await readResponseBody(response);
  if (!response.ok) {
    const msg = getErrorMessageFromBody(data, response);
    throw new Error(
      `When fetching /api/push/register, the response was [${response.status}] ${msg}`,
    );
  }

  return data;
}

export function usePushRegistration({ enabled }) {
  const router = useRouter();
  const { meQuery } = useMe();

  const userId = meQuery.data?.user?.id || null;

  // Avoid hammering permissions on every render.
  const didAttemptRef = useRef(false);

  // If the signed-in user changes, allow a new registration attempt.
  useEffect(() => {
    didAttemptRef.current = false;
  }, [userId]);

  const isMobilePlatform = Platform.OS === "ios" || Platform.OS === "android";
  const shouldRun = !!enabled && isMobilePlatform && meQuery.isSuccess;

  const platform = useMemo(() => {
    if (Platform.OS === "ios") {
      return "ios";
    }
    if (Platform.OS === "android") {
      return "android";
    }
    return null;
  }, []);

  const [error, setError] = useState(null);

  useEffect(() => {
    // Ensure notifications show while app is open.
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (_err) {
      // ignore
    }
  }, []);

  // Clear badge count when app comes to foreground.
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const { AppState } = require("react-native");
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        Notifications.setBadgeCountAsync(0).catch(() => null);
      }
    });
    // Also clear immediately on mount.
    Notifications.setBadgeCountAsync(0).catch(() => null);
    return () => sub.remove();
  }, []);

  const handleOpenFromNotification = useCallback(
    (response) => {
      const data = response?.notification?.request?.content?.data;
      if (!data || typeof data !== "object") {
        return;
      }

      const type = typeof data.type === "string" ? data.type : "";

      const parseNumericId = (value) => {
        if (typeof value === "number") {
          return Number.isFinite(value) ? value : null;
        }
        const n = parseInt(String(value || ""), 10);
        return Number.isFinite(n) ? n : null;
      };

      // Clear badge when user taps a notification.
      Notifications.setBadgeCountAsync(0).catch(() => null);

      // Fire-and-forget analytics for tap-through.
      try {
        const conversationId = parseNumericId(data.conversationId);
        const checkinId = parseNumericId(data.checkinId);
        const requestId = parseNumericId(data.requestId);
        const status = typeof data.status === "string" ? data.status : "";

        trackEvent("push_opened", {
          type,
          conversationId,
          checkinId,
          requestId,
          status: status || null,
        }).catch(() => null);
      } catch (_err) {
        // ignore
      }

      if (type === "message") {
        const id = parseNumericId(data.conversationId);
        if (id && id > 0) {
          router.push(`/messages/${id}`);
        }
        return;
      }

      if (type === "checkin_request") {
        const checkinId = parseNumericId(data.checkinId);
        const requestId = parseNumericId(data.requestId);
        if (!checkinId) {
          return;
        }

        const navParams = { tab: "requests" };
        if (requestId) {
          navParams.requestId = String(requestId);
        }

        router.push({
          pathname: `/plans/${checkinId}`,
          params: navParams,
        });
        return;
      }

      if (type === "checkin_request_update") {
        const status = typeof data.status === "string" ? data.status : "";
        const conversationId = parseNumericId(data.conversationId);
        const checkinId = parseNumericId(data.checkinId);

        if (status === "accepted" && conversationId) {
          router.push(`/messages/${conversationId}`);
          return;
        }

        if (checkinId) {
          router.push(`/plans/${checkinId}`);
        }
        return;
      }

      if (type === "nearby_plan_starting_soon") {
        const checkinId = parseNumericId(data.checkinId);
        if (checkinId) {
          router.push(`/plans/${checkinId}`);
        }
        return;
      }

      // Meetup prompt — take user to the plan detail to confirm.
      if (type === "meetup_prompt" || type === "meetup_nudge") {
        const checkinId = parseNumericId(data.checkinId);
        if (checkinId) {
          router.push({
            pathname: `/plans/${checkinId}`,
            params: { showMeetupConfirm: "1" },
          });
        }
        return;
      }

      // Meetup confirmed — navigate to the confirming user's profile.
      if (type === "meetup_confirmed") {
        const fromUserId = parseNumericId(data.fromUserId);
        if (fromUserId) {
          router.push(`/user/${fromUserId}`);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!shouldRun) {
      return;
    }

    // 1) If the app was opened by tapping a notification, navigate.
    // 2) Also listen for future taps while the app is running.
    let sub = null;

    // Defer cold-start navigation by one tick so the router is mounted
    // before we try to push a route. Without this, tapping a push notification
    // to cold-start the app causes a navigation race condition.
    const coldStartTimer = setTimeout(async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          handleOpenFromNotification(last);
        }
      } catch (err) {
        console.error("Failed reading last notification response", err);
      }
    }, 100);

    try {
      sub = Notifications.addNotificationResponseReceivedListener((resp) => {
        handleOpenFromNotification(resp);
      });
    } catch (err) {
      console.error("Failed adding notification response listener", err);
    }

    return () => {
      clearTimeout(coldStartTimer);
      try {
        sub?.remove?.();
      } catch (_err) {
        // ignore
      }
    };
  }, [handleOpenFromNotification, shouldRun]);

  useEffect(() => {
    const run = async () => {
      if (!shouldRun) {
        return;
      }
      if (didAttemptRef.current) {
        return;
      }
      didAttemptRef.current = true;

      const MAX_RETRIES = 3;
      let attempt = 0;
      let lastErr = null;

      try {
        setError(null);
        await ensureAndroidChannel();

        const { token } = await getExpoPushToken();
        if (!token || !platform) {
          return;
        }

        const last = await safeGetItem(STORAGE_KEY);
        const alreadyRegistered = last && last === token;

        while (attempt < MAX_RETRIES) {
          try {
            // Always refresh lastSeen, even if token hasn't changed.
            await registerWithBackend({ token, platform });
            if (!alreadyRegistered) {
              await safeSetItem(STORAGE_KEY, token);
            }
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            attempt += 1;
            if (attempt < MAX_RETRIES) {
              // Exponential backoff: 2s, 4s
              await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, attempt)));
            }
          }
        }

        if (lastErr) {
          throw lastErr;
        }
      } catch (err) {
        console.error("Push registration failed after retries", err);
        setError("Could not enable push notifications");
      }
    };

    run();
  }, [platform, shouldRun]);

  return {
    meQuery,
    error,
  };
}

export default usePushRegistration;
