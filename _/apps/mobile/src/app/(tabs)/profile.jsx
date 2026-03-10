import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/utils/auth/useAuth";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import { useSubscription } from "@/hooks/useSubscription";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

const { colors, spacing, typography, radius } = darkTheme;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { auth, signOut } = useAuth();
  const { tier, statusQuery } = useSubscription();

  const { refreshControl } = usePullToRefresh({
    queryKeys: [
      ["onboardingStatus"],
      ["blocks"],
      ["notificationsSummary"],
      // keep the full notifications feed key too (other screens depend on it)
      ["notifications"],
      ["billingStatus"],
    ],
  });

  const onboardingQuery = useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: async () => {
      const response = await authedFetch("/api/onboarding/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/onboarding/status, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const profile = onboardingQuery.data?.onboarding?.profile;
  const interests = onboardingQuery.data?.onboarding?.interests;

  const blocksQuery = useQuery({
    queryKey: ["blocks"],
    queryFn: async () => {
      const response = await authedFetch("/api/blocks");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/blocks, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/blocks (DELETE), the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not unblock", "Please try again.");
    },
  });

  const blockedUsers = useMemo(() => {
    const list = blocksQuery.data?.blocked;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [blocksQuery.data?.blocked]);

  const displayName = profile?.displayName || "";
  const bio = profile?.bio || "";
  const locationParts = [];
  if (profile?.city) {
    locationParts.push(profile.city);
  }
  if (profile?.state) {
    locationParts.push(profile.state);
  }
  const locationText = locationParts.join(", ");

  const interestsText = useMemo(() => {
    if (!Array.isArray(interests)) {
      return "";
    }
    return interests.slice(0, 10).join(" · ");
  }, [interests]);

  const planLabel = useMemo(() => {
    if (tier === "premium") {
      return "Premium";
    }
    if (tier === "plus") {
      return "Plus";
    }
    return "Free";
  }, [tier]);

  const notificationsQuery = useQuery({
    queryKey: ["notificationsSummary"],
    queryFn: async () => {
      const response = await authedFetch("/api/notifications?summary=1");
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/notifications?summary=1, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 15000,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  const unreadCount = notificationsQuery.data?.unreadCount || 0;

  const PrimaryButton = ({ title, onPress }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          backgroundColor: colors.yellow,
          paddingVertical: spacing.base,
          borderRadius: radius.md,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            ...typography.body.lg,
            fontWeight: "700",
            color: "#000",
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const SecondaryButton = ({ title, onPress }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          backgroundColor: colors.surfaceElevated,
          paddingVertical: spacing.base,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            ...typography.body.lg,
            fontWeight: "700",
            color: colors.text,
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const userEmail = auth?.user?.email || "";

  const onboardingErrorMessage = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your profile.",
    );
  }, [onboardingQuery.error]);

  const blocksErrorMessage = useMemo(() => {
    if (!blocksQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      blocksQuery.error,
      "Could not load blocked users.",
    );
  }, [blocksQuery.error]);

  const retryOnboarding = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    return () => {
      invalidateMany(queryClient, [["onboardingStatus"]]);
    };
  }, [onboardingQuery.error, queryClient]);

  const retryBlocks = useMemo(() => {
    if (!blocksQuery.error) {
      return null;
    }
    return () => {
      invalidateMany(queryClient, [["blocks"]]);
    };
  }, [blocksQuery.error, queryClient]);

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
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            marginTop: spacing.base,
            ...typography.display.sm,
            color: colors.text,
          }}
        >
          Me
        </Text>

        {/* Upgrade */}
        <View
          style={{
            marginTop: spacing.base,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
            padding: spacing.base,
          }}
        >
          <Text
            style={{
              ...typography.body.lg,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            Plan: {planLabel}
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              ...typography.body.md,
              color: colors.subtext,
              lineHeight: spacing.lg,
            }}
          >
            Upgrade for more map range, more active plans, and plan insights.
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/upgrade")}
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.yellow,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                ...typography.label.lg,
                color: "#000",
              }}
            >
              Upgrade
            </Text>
          </TouchableOpacity>

          {statusQuery.isFetching ? (
            <View style={{ marginTop: spacing.md, alignItems: "center" }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : null}
        </View>

        <View
          style={{
            marginTop: spacing.base,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.lg,
            padding: spacing.base,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.pill,
                overflow: "hidden",
                backgroundColor: colors.chipBg,
              }}
            >
              {profile?.avatarUrl ? (
                <Image
                  source={{ uri: profile.avatarUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...typography.body.lg,
                  fontWeight: "700",
                  color: colors.text,
                }}
              >
                {displayName || "Your name"}
              </Text>
              {locationText ? (
                <Text
                  style={{
                    marginTop: spacing.xs,
                    ...typography.label.md,
                    color: colors.subtext,
                  }}
                >
                  {locationText}
                </Text>
              ) : null}
              {userEmail ? (
                <Text
                  style={{
                    marginTop: spacing.xs,
                    ...typography.label.md,
                    color: colors.subtext,
                  }}
                >
                  {userEmail}
                </Text>
              ) : null}
            </View>
          </View>

          {bio ? (
            <Text
              style={{
                marginTop: spacing.md,
                ...typography.body.md,
                color: colors.text,
                lineHeight: spacing.lg,
              }}
            >
              {bio}
            </Text>
          ) : null}

          {interestsText ? (
            <Text
              style={{
                marginTop: spacing.md,
                ...typography.label.md,
                color: colors.subtext,
              }}
            >
              {interestsText}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.base, gap: spacing.md }}>
          <PrimaryButton
            title="Edit profile"
            onPress={() =>
              router.push({
                pathname: "/onboarding",
                params: { edit: "1", startStep: "0" },
              })
            }
          />

          <SecondaryButton
            title="Settings"
            onPress={() => router.push("/settings")}
          />

          <SecondaryButton
            title="Productivity tracker"
            onPress={() => router.push("/productivity")}
          />

          <SecondaryButton
            title={
              unreadCount ? `Notifications (${unreadCount})` : "Notifications"
            }
            onPress={() => router.push("/notifications")}
          />

          <SecondaryButton
            title="Messages"
            onPress={() => router.push("/messages")}
          />

          <SecondaryButton
            title="Edit photo"
            onPress={() =>
              router.push({
                pathname: "/onboarding",
                params: { edit: "1", startStep: "2" },
              })
            }
          />
          <SecondaryButton title="Sign Out" onPress={() => signOut()} />
        </View>

        {onboardingQuery.isLoading ? (
          <View style={{ marginTop: spacing.base, alignItems: "center" }}>
            <Text
              style={{
                ...typography.body.md,
                color: colors.subtext,
              }}
            >
              Loading…
            </Text>
          </View>
        ) : null}

        <ErrorNotice
          message={onboardingErrorMessage}
          onRetry={retryOnboarding}
          style={onboardingErrorMessage ? { marginTop: spacing.base } : null}
        />

        {/* Blocked users */}
        <View style={{ marginTop: spacing.lg }}>
          <Text
            style={{
              ...typography.heading.md,
              color: colors.text,
            }}
          >
            Blocked
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              ...typography.label.md,
              color: colors.subtext,
            }}
          >
            People you've blocked won't show up on your map, lists, or messages.
          </Text>

          {blocksQuery.isLoading ? (
            <View style={{ marginTop: spacing.md, alignItems: "center" }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : blockedUsers.length ? (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              {blockedUsers.map((u) => {
                const name = u.displayName || "User";
                return (
                  <View
                    key={`blocked-${u.userId}`}
                    style={{
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...typography.body.md,
                          fontWeight: "700",
                          color: colors.text,
                        }}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(
                          `Unblock ${name}?`,
                          "They can show up again.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Unblock",
                              style: "default",
                              onPress: () =>
                                unblockMutation.mutate({
                                  targetUserId: u.userId,
                                }),
                            },
                          ],
                        )
                      }
                      disabled={unblockMutation.isPending}
                      style={{
                        backgroundColor: colors.surfaceElevated,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        opacity: unblockMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          ...typography.label.md,
                          color: colors.text,
                        }}
                      >
                        Unblock
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  ...typography.body.md,
                  color: colors.subtext,
                }}
              >
                No blocked users.
              </Text>
            </View>
          )}

          <ErrorNotice
            message={blocksErrorMessage}
            onRetry={retryBlocks}
            style={blocksErrorMessage ? { marginTop: spacing.md } : null}
          />
        </View>
      </ScrollView>
    </View>
  );
}
