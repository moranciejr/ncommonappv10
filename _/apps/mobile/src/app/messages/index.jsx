import { useMemo, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { MessageCircle, Shield } from "lucide-react-native";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

const { colors, radius, shadow, typography, spacing } = darkTheme;

function initialsFromName(name) {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) {
    return "?";
  }
  const parts = safe.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1] || "";
  const joined = `${first}${second}`.toUpperCase();
  return joined || "?";
}

export default function MessagesIndexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["conversations"]],
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const response = await authedFetch("/api/messages/conversations");
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/messages/conversations, the response was [${response.status}] ${msg}`,
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

  // refresh the list when returning to this screen, but avoid spamming.
  const lastFocusRefreshRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < 5000) {
        return;
      }
      lastFocusRefreshRef.current = now;
      try {
        conversationsQuery.refetch();
      } catch (err) {
        console.error(err);
      }
    }, [conversationsQuery.refetch]),
  );

  const conversations = useMemo(() => {
    const list = conversationsQuery.data?.conversations;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [conversationsQuery.data?.conversations]);

  const errorMessage = useMemo(() => {
    if (!conversationsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      conversationsQuery.error,
      "Could not load messages.",
    );
  }, [conversationsQuery.error]);

  const onRetry = useMemo(() => {
    if (!conversationsQuery.error) {
      return null;
    }

    return () => {
      invalidateMany(queryClient, [["conversations"]]);
    };
  }, [conversationsQuery.error, queryClient]);

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
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            marginTop: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.base,
          }}
        >
          <Text style={{ ...typography.heading.xl, color: colors.text }}>
            Messages
          </Text>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.chipBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MessageCircle size={18} color={colors.purple} />
          </View>
        </View>

        <Text
          style={{
            marginTop: spacing.xs,
            ...typography.body.mdBold,
            color: colors.subtext,
            lineHeight: 18,
          }}
        >
          Your chats. If someone is blocked, they won't appear here.
        </Text>

        <ErrorNotice
          message={errorMessage}
          onRetry={onRetry}
          style={{ marginTop: spacing.md }}
        />

        {conversationsQuery.isLoading ? (
          <View style={{ alignItems: "center", marginTop: spacing.lg }}>
            <ActivityIndicator color={colors.yellow} />
          </View>
        ) : (
          <View style={{ marginTop: spacing.md, gap: spacing.base }}>
            {conversations.length ? (
              conversations.map((c) => {
                const other = c.otherUser || {};
                const name = other.displayName || "Someone";
                const initials = initialsFromName(name);
                const hasAvatar = !!other.avatarUrl;
                const last = c.lastMessage || "";

                return (
                  <TouchableOpacity
                    key={`convo-${c.id}`}
                    onPress={() =>
                      router.push({
                        pathname: `/messages/${c.id}`,
                        params: {
                          otherUserId: String(other.userId || ""),
                          otherDisplayName: name,
                          otherIsMinor: other.isMinor ? "1" : "0",
                        },
                      })
                    }
                    style={{
                      backgroundColor: "rgba(255,255,255,0.98)",
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.xl,
                      padding: spacing.md,
                      ...shadow.card,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: spacing.base,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 999,
                          overflow: "hidden",
                          backgroundColor: colors.chipBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {hasAvatar ? (
                          <Image
                            source={{ uri: other.avatarUrl }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                        ) : (
                          <Text
                            style={{
                              ...typography.body.lgBold,
                              color: colors.purple,
                            }}
                          >
                            {initials}
                          </Text>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: spacing.sm,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: spacing.sm,
                              }}
                            >
                              <Text
                                style={{
                                  flex: 1,
                                  ...typography.body.lgBold,
                                  color: colors.text,
                                }}
                                numberOfLines={1}
                              >
                                {name}
                              </Text>

                              {other.isMinor ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    backgroundColor: colors.minorBg,
                                    borderWidth: 1,
                                    borderColor: "rgba(180, 120, 0, 0.18)",
                                    paddingHorizontal: spacing.sm,
                                    paddingVertical: 6,
                                    borderRadius: 999,
                                  }}
                                >
                                  <Shield size={14} color={colors.minorText} />
                                  <Text
                                    style={{
                                      ...typography.label.sm,
                                      color: colors.minorText,
                                    }}
                                  >
                                    Minor
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>

                        <Text
                          style={{
                            marginTop: spacing.xs,
                            ...typography.body.mdBold,
                            color: colors.subtext,
                          }}
                          numberOfLines={1}
                        >
                          {last ? last : "Say hi."}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "rgba(255,255,255,0.96)",
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  ...shadow.card,
                }}
              >
                <Text
                  style={{
                    ...typography.body.lgBold,
                    color: colors.purple,
                  }}
                >
                  No messages yet
                </Text>
                <Text
                  style={{
                    marginTop: spacing.xs,
                    ...typography.body.mdBold,
                    color: colors.subtext,
                    lineHeight: 18,
                  }}
                >
                  Start a chat from nCommon or Nearest.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
