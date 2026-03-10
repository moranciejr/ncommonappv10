import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { MapPin, Sparkles } from "lucide-react-native";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import ProfileCard from "@/components/Profile/ProfileCard";
import { useDistanceUnit } from "@/hooks/useAppSettings";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { withQuery } from "@/utils/queryString";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

const { colors, spacing, typography, radius } = darkTheme;

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.chipActiveBg : colors.chipBg,
        borderWidth: 1,
        borderColor: selected ? colors.chipActiveBg : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text
        style={{
          ...typography.label.md,
          color: selected ? colors.chipActiveText : colors.chipText,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function minutesUntilStartFromCheckin(checkin) {
  const raw = checkin?.startsAt || checkin?.createdAt || null;
  if (!raw) {
    return null;
  }
  const ms = new Date(raw).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.round((ms - Date.now()) / 60000);
}

function SectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
      <Text
        style={{
          ...typography.heading.md,
          color: colors.text,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: spacing.xs,
            ...typography.label.md,
            color: colors.subtext,
            lineHeight: spacing.base,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export default function NearestScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [selectedInterest, setSelectedInterest] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["onboardingStatus"], ["nearby"]],
    onRefresh: () => setError(null),
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

  const myInterests = useMemo(() => {
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [onboardingQuery.data?.onboarding?.interests]);

  const interestOptions = useMemo(() => {
    return myInterests.slice(0, 10);
  }, [myInterests]);

  const { unit: distanceUnit } = useDistanceUnit();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted) {
          return;
        }
        if (!perm?.granted) {
          setError("Turn on location to see who's nearest.");
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) {
          return;
        }

        const lat = current?.coords?.latitude;
        const lng = current?.coords?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          setCoords({ lat, lng });
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setError("Could not access location.");
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const nearbyQuery = useQuery({
    queryKey: ["nearby", { coords, selectedInterest }],
    enabled: !!coords,
    queryFn: async () => {
      const url = withQuery("/api/users/nearby", {
        lat: coords?.lat,
        lng: coords?.lng,
        interest: selectedInterest || null,
      });

      const response = await authedFetch(url);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching ${url}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ targetUserId, nextStarred }) => {
      const response = await authedFetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextStarred ? "add" : "remove",
          targetUserId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/stars, the response was [${response.status}] ${msg}`,
        );
      }
      return { ok: true, isStarred: !!data?.isStarred };
    },
    onMutate: async ({ targetUserId, nextStarred }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: ["nearby"] });

      const previous = queryClient.getQueryData([
        "nearby",
        { coords, selectedInterest },
      ]);

      queryClient.setQueryData(
        ["nearby", { coords, selectedInterest }],
        (old) => {
          const list = old?.users;
          if (!Array.isArray(list)) {
            return old;
          }
          const next = list.map((u) => {
            if (u.id !== targetUserId) {
              return u;
            }
            return { ...u, isStarred: nextStarred };
          });
          return { ...old, users: next };
        },
      );

      return { previous };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      setError("Could not update star.");
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["nearby", { coords, selectedInterest }],
          ctx.previous,
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/blocks, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onMutate: async ({ targetUserId }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: ["nearby"] });

      const previous = queryClient.getQueryData([
        "nearby",
        { coords, selectedInterest },
      ]);

      queryClient.setQueryData(
        ["nearby", { coords, selectedInterest }],
        (old) => {
          const list = old?.users;
          if (!Array.isArray(list)) {
            return old;
          }
          return { ...old, users: list.filter((u) => u.id !== targetUserId) };
        },
      );

      return { previous };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      setError("Could not block user.");
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["nearby", { coords, selectedInterest }],
          ctx.previous,
        );
      }
    },
    onSuccess: () => {
      Alert.alert("Blocked", "They won’t show up for you anymore.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          err.status = 403;
          throw err;
        }
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
    onSuccess: async () => {
      await invalidateMany(queryClient, [["conversations"], ["notifications"]]);
    },
    onError: (err) => {
      console.error(err);
      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        setPrompt(
          nudge || {
            title: "Verify your email",
            message: "Please verify your email before messaging people.",
            primaryCta: "Verify email",
            secondaryCta: "Not now",
            target: "/verify-email",
            reason: "email_verify_required_start_chat",
          },
        );
        return;
      }
      if (err?.status === 403) {
        setError(err?.userMessage || "Can't message this person.");
        return;
      }
      setError("Could not start chat.");
    },
  });

  const people = useMemo(() => {
    const list = nearbyQuery.data?.users;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [nearbyQuery.data?.users]);

  // NEW: group into explicit sections so time-sensitive people stand out.
  const buckets = useMemo(() => {
    const happeningNow = [];
    const startsSoon = [];
    const later = [];

    for (const p of people) {
      const minsUntilStart = minutesUntilStartFromCheckin(p?.checkin);

      // Happening now: already started, or starts within ~5 mins.
      if (typeof minsUntilStart === "number" && minsUntilStart <= 5) {
        happeningNow.push(p);
        continue;
      }

      // Starts soon: starts 5–60 mins.
      if (
        typeof minsUntilStart === "number" &&
        minsUntilStart > 5 &&
        minsUntilStart <= 60
      ) {
        startsSoon.push(p);
        continue;
      }

      later.push(p);
    }

    const byDistance = (a, b) => {
      const aDist = typeof a?.distanceKm === "number" ? a.distanceKm : 999999;
      const bDist = typeof b?.distanceKm === "number" ? b.distanceKm : 999999;
      return aDist - bDist;
    };

    happeningNow.sort(byDistance);
    startsSoon.sort(byDistance);
    later.sort(byDistance);

    return {
      happeningNow,
      startsSoon,
      later,
      counts: {
        happeningNow: happeningNow.length,
        startsSoon: startsSoon.length,
        total: people.length,
      },
    };
  }, [people]);

  const headerSubtitle = useMemo(() => {
    const nowCount = buckets?.counts?.happeningNow || 0;
    const soonCount = buckets?.counts?.startsSoon || 0;

    const parts = [];
    if (nowCount > 0) {
      const suffix = nowCount === 1 ? "person" : "people";
      parts.push(`${nowCount} ${suffix} happening now`);
    }
    if (soonCount > 0) {
      const suffix = soonCount === 1 ? "person" : "people";
      parts.push(`${soonCount} ${suffix} starting soon`);
    }

    if (parts.length) {
      return `Plans happening around you • ${parts.join(" • ")}`;
    }

    return "Plans happening around you. Look for “Happening now” and “Starts soon” when someone has a real start time.";
  }, [buckets?.counts?.happeningNow, buckets?.counts?.startsSoon]);

  const toggleInterest = useCallback((interest) => {
    setSelectedInterest((current) => (current === interest ? null : interest));
  }, []);

  const handleBlockUser = useCallback(
    (targetUserId) => {
      if (!targetUserId || blockMutation.isPending) {
        return;
      }
      blockMutation.mutate({ targetUserId });
    },
    [blockMutation],
  );

  const handleMessageUser = useCallback(
    (person) => {
      const targetUserId = person?.id;
      if (!targetUserId || startConversationMutation.isPending) {
        return;
      }
      setError(null);
      startConversationMutation.mutate(
        { targetUserId },
        {
          onSuccess: (data) => {
            const conversationId = data?.conversationId;
            if (!conversationId) {
              setError("Could not start chat.");
              return;
            }
            router.push({
              pathname: `/messages/${conversationId}`,
              params: {
                otherUserId: String(targetUserId),
                otherDisplayName: person.displayName || "Chat",
              },
            });
          },
        },
      );
    },
    [router, startConversationMutation],
  );

  const handleOpenProfile = useCallback(
    (person) => {
      const targetUserId = person?.id;
      if (!targetUserId) {
        return;
      }
      router.push(`/user/${targetUserId}`);
    },
    [router],
  );

  const nearbyErrorMessage = useMemo(() => {
    if (!nearbyQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      nearbyQuery.error,
      "Could not load nearby users.",
    );
  }, [nearbyQuery.error]);

  const onboardingErrorMessage = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your profile.",
    );
  }, [onboardingQuery.error]);

  const showError = error || nearbyErrorMessage || onboardingErrorMessage;

  const canRetry = !!nearbyQuery.error || !!onboardingQuery.error;

  const onRetry = useCallback(() => {
    setError(null);
    invalidateMany(queryClient, [["onboardingStatus"], ["nearby"]]);
  }, [queryClient]);

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        <UpgradePromptModal
          visible={!!prompt}
          title={prompt?.title}
          message={prompt?.message}
          primaryText={prompt?.primaryCta || "Continue"}
          secondaryText={prompt?.secondaryCta || "Not now"}
          onPrimary={() => {
            const target = prompt?.target || "/verify-email";
            setPrompt(null);
            router.push(target);
          }}
          onClose={() => setPrompt(null)}
        />

        <ScrollView
          style={{ flex: 1 }}
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: insets.bottom + 140,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginTop: spacing.base }}>
            <Text
              style={{
                ...typography.display.sm,
                color: colors.text,
              }}
            >
              Nearest
            </Text>
            <Text
              style={{
                marginTop: spacing.sm,
                ...typography.body.md,
                color: colors.subtext,
                lineHeight: spacing.lg,
              }}
            >
              {headerSubtitle}
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/upgrade")}
              style={{
                marginTop: spacing.md,
                paddingHorizontal: spacing.md,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                alignSelf: "flex-start",
                gap: spacing.sm,
              }}
            >
              <Sparkles size={16} color={colors.yellow} />
              <Text
                style={{
                  ...typography.label.md,
                  color: colors.yellow,
                }}
              >
                Upgrade
              </Text>
            </TouchableOpacity>
          </View>

          <ErrorNotice
            message={showError}
            onRetry={canRetry ? onRetry : null}
            style={showError ? { marginTop: spacing.base } : null}
          />

          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: colors.surfaceElevated,
              borderRadius: radius.lg,
              padding: spacing.base,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                ...typography.label.lg,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              Filter by interest
            </Text>

            {interestOptions.length ? (
              <ScrollView
                horizontal
                style={{ flexGrow: 0 }}
                showsHorizontalScrollIndicator={false}
              >
                {interestOptions.map((it) => {
                  const label = getInterestLabel(it) || it;
                  return (
                    <Chip
                      key={it}
                      label={label}
                      selected={selectedInterest === it}
                      onPress={() => toggleInterest(it)}
                    />
                  );
                })}
              </ScrollView>
            ) : (
              <Text
                style={{
                  ...typography.body.md,
                  color: colors.subtext,
                }}
              >
                Finish onboarding to pick interests.
              </Text>
            )}

            {/* Map CTA */}
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/map",
                  params: {
                    focus: "user",
                    focusNonce: String(Date.now()),
                    from: "nearest",
                  },
                })
              }
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.purple,
                borderRadius: radius.md,
                padding: spacing.base,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    ...typography.body.lg,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  Open the map
                </Text>
                <Text
                  style={{
                    marginTop: spacing.xs,
                    ...typography.label.md,
                    color: colors.subtext,
                  }}
                >
                  Tap a hotspot to see people + events.
                </Text>
              </View>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.md,
                  backgroundColor: colors.yellow,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MapPin size={18} color="#000" />
              </View>
            </TouchableOpacity>
          </View>

          {nearbyQuery.isLoading ? (
            <View style={{ alignItems: "center", marginTop: spacing.lg }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              {people.length ? (
                <>
                  {buckets.happeningNow.length ? (
                    <>
                      <SectionHeader
                        title="Happening now"
                        subtitle="Already started, or starts within ~5 mins."
                      />
                      <View style={{ gap: spacing.md }}>
                        {buckets.happeningNow.map((p) => (
                          <ProfileCard
                            key={p.id}
                            person={p}
                            variant="nearest"
                            distanceUnit={distanceUnit}
                            onPress={() => handleOpenProfile(p)}
                            isToggling={starMutation.isPending}
                            onToggleStar={(id, next) =>
                              starMutation.mutate({
                                targetUserId: id,
                                nextStarred: next,
                              })
                            }
                            onMessage={handleMessageUser}
                            isMessaging={startConversationMutation.isPending}
                            onBlock={(id) => handleBlockUser(id)}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}

                  {buckets.startsSoon.length ? (
                    <>
                      <SectionHeader
                        title="Starts soon"
                        subtitle="Starting in the next hour."
                      />
                      <View style={{ gap: spacing.md }}>
                        {buckets.startsSoon.map((p) => (
                          <ProfileCard
                            key={p.id}
                            person={p}
                            variant="nearest"
                            distanceUnit={distanceUnit}
                            onPress={() => handleOpenProfile(p)}
                            isToggling={starMutation.isPending}
                            onToggleStar={(id, next) =>
                              starMutation.mutate({
                                targetUserId: id,
                                nextStarred: next,
                              })
                            }
                            onMessage={handleMessageUser}
                            isMessaging={startConversationMutation.isPending}
                            onBlock={(id) => handleBlockUser(id)}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}

                  {buckets.later.length ? (
                    <>
                      <SectionHeader
                        title="Later"
                        subtitle="Upcoming plans nearby."
                      />
                      <View style={{ gap: spacing.md }}>
                        {buckets.later.map((p) => (
                          <ProfileCard
                            key={p.id}
                            person={p}
                            variant="nearest"
                            distanceUnit={distanceUnit}
                            onPress={() => handleOpenProfile(p)}
                            isToggling={starMutation.isPending}
                            onToggleStar={(id, next) =>
                              starMutation.mutate({
                                targetUserId: id,
                                nextStarred: next,
                              })
                            }
                            onMessage={handleMessageUser}
                            isMessaging={startConversationMutation.isPending}
                            onBlock={(id) => handleBlockUser(id)}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                </>
              ) : (
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
                    No nearby plans
                  </Text>
                  <Text
                    style={{
                      marginTop: spacing.sm,
                      ...typography.body.md,
                      color: colors.subtext,
                      lineHeight: spacing.lg,
                    }}
                  >
                    Tap Map → Post a plan to show up here.
                  </Text>
                </View>
              )}
            </View>
          )}

          {nearbyQuery.isFetching && !nearbyQuery.isLoading ? (
            <View style={{ marginTop: spacing.base, alignItems: "center" }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
