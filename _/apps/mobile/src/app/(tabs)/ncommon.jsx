import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { MapPin, Sparkles } from "lucide-react-native";
import { colors, radii, shadow } from "@/utils/theme";
import ProfileCard from "@/components/Profile/ProfileCard";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { shouldShowDevUi } from "@/utils/env";
import { withQuery } from "@/utils/queryString";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : colors.card;
  const color = selected ? colors.primaryText : colors.text;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: 10,
        ...(selected ? shadow.card : {}),
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function NCommonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const showDevUi = useMemo(() => shouldShowDevUi(), []);

  const [selectedInterest, setSelectedInterest] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["onboardingStatus"], ["ncommon"]],
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
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.slice(0, 10);
  }, [onboardingQuery.data?.onboarding?.interests]);

  const ncommonQuery = useQuery({
    queryKey: ["ncommon", { selectedInterest, search }],
    queryFn: async () => {
      const searchTrim = typeof search === "string" ? search.trim() : "";
      const url = withQuery("/api/users/ncommon", {
        interest: selectedInterest || null,
        search: searchTrim || null,
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
      await queryClient.cancelQueries({ queryKey: ["ncommon"] });

      const previous = queryClient.getQueryData([
        "ncommon",
        { selectedInterest, search },
      ]);

      queryClient.setQueryData(
        ["ncommon", { selectedInterest, search }],
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
          ["ncommon", { selectedInterest, search }],
          ctx.previous,
        );
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
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
      await queryClient.cancelQueries({ queryKey: ["ncommon"] });

      const previous = queryClient.getQueryData([
        "ncommon",
        { selectedInterest, search },
      ]);

      queryClient.setQueryData(
        ["ncommon", { selectedInterest, search }],
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
          ["ncommon", { selectedInterest, search }],
          ctx.previous,
        );
      }
    },
    onSuccess: () => {
      Alert.alert("Blocked", "They won’t show up for you anymore.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
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
    const list = ncommonQuery.data?.users;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [ncommonQuery.data?.users]);

  const toggleInterest = useCallback(
    (interest) => {
      setSelectedInterest((current) => {
        if (current === interest) {
          return null;
        }
        return interest;
      });
    },
    [setSelectedInterest],
  );

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

  const onboardingErrorMessage = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    // Check if it's a 403 (onboarding required)
    const errorStr = String(onboardingQuery.error?.message || "");
    if (errorStr.includes("[403]") || errorStr.includes("onboarding")) {
      return "Complete your profile to see people.";
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your profile.",
    );
  }, [onboardingQuery.error]);

  const ncommonErrorMessage = useMemo(() => {
    if (!ncommonQuery.error) {
      return null;
    }
    // Check if it's a 403 (onboarding required)
    const errorStr = String(ncommonQuery.error?.message || "");
    if (errorStr.includes("[403]") || errorStr.includes("onboarding")) {
      return "Complete your profile to see people.";
    }
    return friendlyErrorMessage(ncommonQuery.error, "Could not load people.");
  }, [ncommonQuery.error]);

  const errorMessage = error || ncommonErrorMessage || onboardingErrorMessage;

  const canRetry = !!ncommonQuery.error || !!onboardingQuery.error;

  const onRetry = useCallback(() => {
    setError(null);
    invalidateMany(queryClient, [["onboardingStatus"], ["ncommon"]]);
  }, [queryClient]);

  const resultTitle = useMemo(() => {
    if (selectedInterest) {
      const label = getInterestLabel(selectedInterest) || selectedInterest;
      return `People into ${label}`;
    }
    return "Your nCommon";
  }, [selectedInterest]);

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
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 140,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: colors.text,
              }}
            >
              nCommon
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 13,
                color: colors.subtext,
                lineHeight: 18,
                fontWeight: "700",
              }}
            >
              People who share your interests.
            </Text>

            {/* Upgrade quick entry */}
            <TouchableOpacity
              onPress={() => router.push("/upgrade")}
              style={{
                marginTop: 12,
                paddingHorizontal: 12,
                height: 36,
                borderRadius: 999,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                alignSelf: "flex-start",
                gap: 6,
                ...shadow.card,
              }}
            >
              <Sparkles size={16} color={colors.primary} />
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "900",
                  fontSize: 12,
                }}
              >
                Upgrade
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View
            style={{
              marginTop: 12,
              backgroundColor: colors.card,
              borderRadius: radii.card,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadow.card,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "900",
                color: colors.primary,
                marginBottom: 10,
              }}
            >
              Filter
            </Text>

            {interestOptions.length ? (
              <ScrollView
                horizontal
                style={{ flexGrow: 0 }}
                showsHorizontalScrollIndicator={false}
              >
                {interestOptions.map((interest) => {
                  const label = getInterestLabel(interest) || interest;
                  return (
                    <Chip
                      key={interest}
                      label={label}
                      selected={selectedInterest === interest}
                      onPress={() => toggleInterest(interest)}
                    />
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                Finish onboarding to set interests.
              </Text>
            )}

            {/* Keep search, but make it compact */}
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "900",
                  color: colors.subtext,
                }}
              >
                Search
              </Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Name, interest, city"
                placeholderTextColor="#98A2B3"
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  height: 44,
                  backgroundColor: "#FFFFFF",
                  color: colors.text,
                  fontSize: 15,
                }}
                returnKeyType="search"
              />
            </View>

            {/* Map CTA */}
            <TouchableOpacity
              onPress={() => router.navigate("/map")}
              style={{
                marginTop: 12,
                backgroundColor: colors.surfaceTint,
                borderRadius: 16,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: colors.text }}>
                  Try the map view
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.subtext,
                  }}
                >
                  Events + check-ins around you.
                </Text>
              </View>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 14,
                  backgroundColor: colors.chipBg,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <MapPin size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          <ErrorNotice
            message={errorMessage}
            onRetry={canRetry ? onRetry : null}
            style={errorMessage ? { marginTop: 14 } : null}
          />

          {ncommonQuery.isLoading ? (
            <View style={{ alignItems: "center", marginTop: 18 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ marginTop: 14 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.text,
                  marginBottom: 10,
                }}
              >
                {resultTitle}
              </Text>

              <View style={{ gap: 12 }}>
                {people.length ? (
                  people.map((person) => (
                    <ProfileCard
                      key={person.id}
                      person={person}
                      variant="ncommon"
                      onPress={() => handleOpenProfile(person)}
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
                  ))
                ) : (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      borderRadius: radii.card,
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "900",
                        color: colors.text,
                      }}
                    >
                      No results yet
                    </Text>
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: colors.subtext,
                        lineHeight: 18,
                        fontWeight: "700",
                      }}
                    >
                      {showDevUi
                        ? "Go to Map → Demo to see what this looks like with a crowd."
                        : "Try the map, or check back soon as more people join."}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
