import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react-native";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";
import { parseId } from "@/utils/conversationUtils";
import { safeBack } from "@/utils/navigation";

const { colors, radius, shadow, typography, spacing } = darkTheme;

function titleForNotification(n) {
  const type = n?.type;
  if (type === "checkin_view") {
    return "Someone viewed your plan";
  }
  if (type === "checkin_request") {
    return "Someone wants to join";
  }
  if (type === "checkin_request_update") {
    const status = n?.payload?.status;
    if (status === "accepted") {
      return "Your request was accepted";
    }
    if (status === "declined") {
      return "Your request was declined";
    }
    if (status === "cancelled") {
      return "A request was cancelled";
    }
    return "Request updated";
  }
  if (type === "nearby_plan_starting_soon") {
    return "Plan starting soon";
  }
  if (type === "message") {
    return "New message";
  }
  return "Notification";
}

function subtitleForNotification(n) {
  const type = n?.type;
  const payload = n?.payload || {};

  const checkinId = payload?.checkinId;
  const conversationId = payload?.conversationId;

  if (type === "nearby_plan_starting_soon") {
    const interest = payload?.interest;
    const locationName = payload?.locationName;
    const bits = [];
    if (interest) bits.push(String(interest));
    if (locationName) bits.push(String(locationName));
    const prefix = bits.length ? `${bits.join(" • ")} • ` : "";
    if (typeof checkinId === "number" || typeof checkinId === "string") {
      return `${prefix}Tap to open the plan`;
    }
    return `${prefix}Tap to open`;
  }

  if (type === "message" && conversationId) {
    return "Tap to open messages";
  }

  if (
    type === "checkin_request" ||
    type === "checkin_request_update" ||
    type === "checkin_view"
  ) {
    if (typeof checkinId === "number" || typeof checkinId === "string") {
      return `Tap to open plan #${checkinId}`;
    }
    return "Tap to open plan";
  }

  if (conversationId) {
    return "Tap to open messages";
  }

  if (typeof checkinId === "number" || typeof checkinId === "string") {
    return `Tap to open plan #${checkinId}`;
  }

  return "";
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["notifications"], ["notificationsSummary"]],
  });

  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const hasShownPromptRef = useRef(false);

  // NEW: show a small, user-friendly error when a notification can't be opened.
  const [tapError, setTapError] = useState(null);

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await authedFetch("/api/notifications");
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/notifications, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }
      return data;
    },
    staleTime: 15000,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  // NEW: refresh notifications when returning to this screen, but avoid spamming.
  const lastFocusRefreshRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < 5000) {
        return;
      }
      lastFocusRefreshRef.current = now;
      try {
        notificationsQuery.refetch();
      } catch (err) {
        console.error(err);
      }
    }, [notificationsQuery.refetch]),
  );

  useEffect(() => {
    const nudge = notificationsQuery.data?.upgradeNudge;
    if (!nudge) {
      return;
    }
    if (hasShownPromptRef.current) {
      return;
    }
    hasShownPromptRef.current = true;
    setUpgradePrompt(nudge);
  }, [notificationsQuery.data?.upgradeNudge]);

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/notifications, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }
      return data;
    },
    onSuccess: async () => {
      // Optimistically clear unread in cache so the tab badge drops immediately.
      const nowIso = new Date().toISOString();
      queryClient.setQueryData(["notifications"], (old) => {
        if (!old || typeof old !== "object") {
          return old;
        }
        const list = Array.isArray(old.notifications) ? old.notifications : [];
        const next = list.map((n) => {
          if (!n || typeof n !== "object") {
            return n;
          }
          if (n.isRead) {
            return n;
          }
          return { ...n, isRead: true, readAt: n.readAt || nowIso };
        });
        return { ...old, unreadCount: 0, notifications: next };
      });

      queryClient.setQueryData(["notificationsSummary"], (old) => {
        if (!old || typeof old !== "object") {
          return { ok: true, unreadCount: 0 };
        }
        return { ...old, unreadCount: 0 };
      });

      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["notificationsSummary"],
      });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authedFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/notifications, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }
      return data;
    },
    onSuccess: async (_data, id) => {
      const nowIso = new Date().toISOString();

      queryClient.setQueryData(["notifications"], (old) => {
        if (!old || typeof old !== "object") {
          return old;
        }
        const list = Array.isArray(old.notifications) ? old.notifications : [];
        let didChange = false;
        const next = list.map((n) => {
          if (!n || typeof n !== "object") {
            return n;
          }
          if (n.id !== id) {
            return n;
          }
          if (n.isRead) {
            return n;
          }
          didChange = true;
          return { ...n, isRead: true, readAt: n.readAt || nowIso };
        });

        const currentUnread = old.unreadCount || 0;
        const nextUnread = didChange
          ? Math.max(0, currentUnread - 1)
          : currentUnread;
        return { ...old, unreadCount: nextUnread, notifications: next };
      });

      queryClient.setQueryData(["notificationsSummary"], (old) => {
        const currentUnread = old?.unreadCount || 0;
        const nextUnread = Math.max(0, currentUnread - 1);
        return { ...(old || {}), unreadCount: nextUnread };
      });

      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({
        queryKey: ["notificationsSummary"],
      });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const items = useMemo(() => {
    const list = notificationsQuery.data?.notifications;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [notificationsQuery.data?.notifications]);

  const unreadCount = notificationsQuery.data?.unreadCount || 0;

  // NEW: mark notifications as read once they’ve been shown (matches common badge behavior)
  const autoMarkedRef = useRef(false);
  useEffect(() => {
    if (notificationsQuery.isLoading || notificationsQuery.error) {
      return;
    }
    if (autoMarkedRef.current) {
      return;
    }
    if (!unreadCount) {
      return;
    }
    // Wait a beat so the UI renders first; avoids marking read on accidental flashes.
    const t = setTimeout(() => {
      if (markAllMutation.isPending) {
        return;
      }
      autoMarkedRef.current = true;
      markAllMutation.mutate();
    }, 1200);

    return () => clearTimeout(t);
  }, [
    notificationsQuery.isLoading,
    notificationsQuery.error,
    unreadCount,
    markAllMutation,
  ]);

  // Reset the auto-mark when you come back later.
  useFocusEffect(
    useCallback(() => {
      autoMarkedRef.current = false;
      return () => {};
    }, []),
  );

  const openNotification = useCallback(
    (n) => {
      setTapError(null);

      const type = n?.type;
      const payload = n?.payload || {};

      const conversationId = parseId(payload?.conversationId);
      const checkinId = parseId(payload?.checkinId);
      const requestId = parseId(payload?.requestId);
      const status = typeof payload?.status === "string" ? payload.status : "";

      if (!n?.isRead && n?.id) {
        markOneMutation.mutate(n.id);
      }

      if (type === "message") {
        if (!conversationId) {
          setTapError("This message notification is missing a chat link.");
          return;
        }
        router.push(`/messages/${conversationId}`);
        return;
      }

      if (type === "checkin_request") {
        if (!checkinId) {
          setTapError("This notification is missing a plan link.");
          return;
        }

        const navParams = { tab: "requests" };
        if (requestId) {
          navParams.requestId = String(requestId);
        }

        router.push({ pathname: `/plans/${checkinId}`, params: navParams });
        return;
      }

      if (type === "checkin_request_update") {
        if (status === "accepted" && conversationId) {
          router.push(`/messages/${conversationId}`);
          return;
        }
        if (!checkinId) {
          setTapError("This notification is missing a plan link.");
          return;
        }
        router.push(`/plans/${checkinId}`);
        return;
      }

      if (type === "nearby_plan_starting_soon") {
        if (!checkinId) {
          setTapError("This notification is missing a plan link.");
          return;
        }
        router.push(`/plans/${checkinId}`);
        return;
      }

      if (conversationId) {
        router.push(`/messages/${conversationId}`);
        return;
      }

      if (checkinId) {
        router.push(`/plans/${checkinId}`);
        return;
      }

      setTapError("Nothing to open for this notification.");
    },
    [markOneMutation, router],
  );

  const errorMessage = useMemo(() => {
    if (!notificationsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      notificationsQuery.error,
      "Could not load notifications.",
    );
  }, [notificationsQuery.error]);

  const onRetry = useMemo(() => {
    if (!notificationsQuery.error) {
      return null;
    }

    return () => {
      invalidateMany(queryClient, [["notifications"]]);
    };
  }, [notificationsQuery.error, queryClient]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            marginTop: spacing.base,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => safeBack(router, "/map")}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              ...shadow.card,
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={{ ...typography.heading.lg, color: colors.text }}>
            Notifications
          </Text>

          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending || !unreadCount}
            style={{
              height: 44,
              paddingHorizontal: spacing.base,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: markAllMutation.isPending || !unreadCount ? 0.5 : 1,
              ...shadow.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <Check size={18} color={colors.purple} />
              <Text style={{ ...typography.body.lgBold, color: colors.purple }}>
                Read
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            marginTop: spacing.sm,
            ...typography.body.mdBold,
            color: colors.subtext,
          }}
        >
          {unreadCount ? `${unreadCount} unread` : "All caught up"}
        </Text>

        {/* NEW: tap errors (e.g. missing payload) */}
        <ErrorNotice
          message={tapError}
          onRetry={null}
          retryLabel=""
          style={{ marginTop: spacing.base }}
        />

        {notificationsQuery.data?.usage?.tier === "free" ? (
          <TouchableOpacity
            onPress={() => router.push("/upgrade")}
            style={{
              marginTop: spacing.base,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.md,
              ...shadow.card,
            }}
          >
            <Text style={{ ...typography.body.lgBold, color: colors.text }}>
              Upgrade for more activity history
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.subtext,
                ...typography.body.mdBold,
                lineHeight: 18,
              }}
            >
              Free keeps your latest{" "}
              {notificationsQuery.data?.usage?.notificationsLimit || 20}{" "}
              notifications.
            </Text>
          </TouchableOpacity>
        ) : null}

        {notificationsQuery.isLoading ? (
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <ActivityIndicator color={colors.yellow} />
          </View>
        ) : notificationsQuery.error ? (
          <ErrorNotice
            message={errorMessage}
            onRetry={onRetry}
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {items.length ? (
              items.map((n) => {
                const title = titleForNotification(n);
                const subtitle = subtitleForNotification(n);
                const borderColor = n.isRead
                  ? colors.border
                  : "rgba(45,17,77,0.22)";

                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => openNotification(n)}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor,
                      borderRadius: radius.xl,
                      padding: spacing.md,
                      ...shadow.card,
                    }}
                  >
                    <Text
                      style={{ ...typography.body.lgBold, color: colors.text }}
                    >
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text
                        style={{
                          marginTop: spacing.xs,
                          color: colors.subtext,
                          ...typography.body.mdBold,
                          lineHeight: 18,
                        }}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                }}
              >
                <Text style={{ ...typography.body.lgBold, color: colors.text }}>
                  No notifications yet
                </Text>
                <Text
                  style={{
                    marginTop: spacing.xs,
                    color: colors.subtext,
                    ...typography.body.mdBold,
                    lineHeight: 18,
                  }}
                >
                  When someone views or requests to join your plan, you'll see
                  it here.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <UpgradePromptModal
        visible={!!upgradePrompt}
        title={upgradePrompt?.title}
        message={upgradePrompt?.message}
        primaryText={upgradePrompt?.primaryCta || "Upgrade"}
        secondaryText={upgradePrompt?.secondaryCta || "Not now"}
        onPrimary={() => {
          const target = upgradePrompt?.target || "/upgrade";
          setUpgradePrompt(null);
          router.push(target);
        }}
        onClose={() => setUpgradePrompt(null)}
      />
    </View>
  );
}
