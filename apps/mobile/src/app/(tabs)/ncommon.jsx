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
import { Search, X } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";
import ProfileCard from "@/components/Profile/ProfileCard";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { shouldShowDevUi } from "@/utils/env";
import { withQuery } from "@/utils/queryString";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

const { colors, spacing, typography, radius } = darkTheme;

function InterestChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.yellow : colors.surfaceElevated,
        borderWidth: 1,
        borderColor: selected ? colors.yellow : colors.border,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: selected ? "#000" : colors.text,
        }}
      >
        {label}
      </Text>
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
  const [searchVisible, setSearchVisible] = useState(false);
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
    staleTime: 1000 * 60 * 5,
  });

  const interestOptions = useMemo(() => {
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) return [];
    return list.slice(0, 10);
  }, [onboardingQuery.data?.onboarding?.interests]);

  const ncommonQuery = useQuery({
    queryKey: ["ncommon", { selectedInterest, search }],
    enabled: onboardingQuery.isSuccess,
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
    staleTime: 1000 * 15,
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
          if (!Array.isArray(list)) return old;
          return {
            ...old,
            users: list.map((u) =>
              u.id !== targetUserId ? u : { ...u, isStarred: nextStarred },
            ),
          };
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
          if (!Array.isArray(list)) return old;
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
      Alert.alert("Blocked", "They won't show up for you anymore.");
    },
    onSettled: async () => {
      await invalidateMany(queryClient, [
        ["ncommon"],
        ["nearby"],
        ["mapPoints"],
        ["stars"],
        ["blocks"],
      ]);
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
    if (!Array.isArray(list)) return [];
    return list;
  }, [ncommonQuery.data?.users]);

  const activePeople = useMemo(
    () => people.filter((p) => !!p.checkin),
    [people],
  );
  const activeCount = activePeople.length;

  const toggleInterest = useCallback((interest) => {
    setSelectedInterest((current) => (current === interest ? null : interest));
  }, []);

  const handleBlockUser = useCallback(
    (targetUserId) => {
      if (!targetUserId || blockMutation.isPending) return;
      blockMutation.mutate({ targetUserId });
    },
    [blockMutation],
  );

  const handleMessageUser = useCallback(
    (person) => {
      const targetUserId = person?.id;
      if (!targetUserId || startConversationMutation.isPending) return;
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
      if (!targetUserId) return;
      router.push(`/user/${targetUserId}`);
    },
    [router],
  );

  const errorMessage = useMemo(() => {
    if (error) return error;
    if (ncommonQuery.error) {
      const s = String(ncommonQuery.error?.message || "");
      if (s.includes("[403]") || s.includes("onboarding"))
        return "Complete your profile to see people.";
      return friendlyErrorMessage(ncommonQuery.error, "Could not load people.");
    }
    if (onboardingQuery.error) {
      const s = String(onboardingQuery.error?.message || "");
      if (s.includes("[403]") || s.includes("onboarding"))
        return "Complete your profile to see people.";
      return friendlyErrorMessage(
        onboardingQuery.error,
        "Could not load your profile.",
      );
    }
    return null;
  }, [error, ncommonQuery.error, onboardingQuery.error]);

  const canRetry = !!ncommonQuery.error || !!onboardingQuery.error;

  const onRetry = useCallback(() => {
    setError(null);
    invalidateMany(queryClient, [["onboardingStatus"], ["ncommon"]]);
  }, [queryClient]);

  const sectionTitle = useMemo(() => {
    if (selectedInterest) {
      const label = getInterestLabel(selectedInterest) || selectedInterest;
      return `Into ${label}`;
    }
    return "People nearby";
  }, [selectedInterest]);

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            paddingBottom: insets.bottom + 140,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View
            style={{
              paddingTop: insets.top + spacing.base,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.base,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 28,
                    fontWeight: "800",
                    color: colors.text,
                    letterSpacing: -0.5,
                  }}
                >
                  nCommon
                </Text>
                {activeCount > 0 && !ncommonQuery.isLoading && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: "#34D399",
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "600",
                        color: colors.subtext,
                      }}
                    >
                      {activeCount} people with your interests nearby
                    </Text>
                  </View>
                )}
              </View>

              {/* Search toggle */}
              <TouchableOpacity
                onPress={() => {
                  setSearchVisible((v) => !v);
                  if (searchVisible) setSearch("");
                }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.md,
                  backgroundColor: searchVisible
                    ? colors.yellow
                    : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: searchVisible ? colors.yellow : colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {searchVisible ? (
                  <X size={18} color="#000" />
                ) : (
                  <Search size={18} color={colors.subtext} />
                )}
              </TouchableOpacity>
            </View>

            {/* Search input — only visible when toggled */}
            {searchVisible && (
              <View style={{ marginTop: spacing.sm }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Name, interest, city…"
                  placeholderTextColor={colors.mutedText}
                  autoFocus
                  style={{
                    height: 44,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.base,
                    backgroundColor: colors.surfaceElevated,
                    color: colors.text,
                    fontSize: 15,
                  }}
                  returnKeyType="search"
                />
              </View>
            )}
          </View>

          {/* ── Interest chips ── */}
          {interestOptions.length > 0 && (
            <ScrollView
              horizontal
              style={{ flexGrow: 0 }}
              contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                paddingBottom: spacing.base,
              }}
              showsHorizontalScrollIndicator={false}
            >
              {interestOptions.map((interest) => {
                const label = getInterestLabel(interest) || interest;
                return (
                  <InterestChip
                    key={interest}
                    label={label}
                    selected={selectedInterest === interest}
                    onPress={() => toggleInterest(interest)}
                  />
                );
              })}
            </ScrollView>
          )}

          <ErrorNotice
            message={errorMessage}
            onRetry={canRetry ? onRetry : null}
            style={
              errorMessage
                ? {
                    marginHorizontal: spacing.xl,
                    marginBottom: spacing.base,
                  }
                : null
            }
          />

          {/* ── People list ── */}
          <View style={{ paddingHorizontal: spacing.xl }}>
            {ncommonQuery.isLoading ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: spacing.xl,
                }}
              >
                <ActivityIndicator color={colors.subtext} />
              </View>
            ) : (
              <>
                {/* ── Active right now ── */}
                {activePeople.length > 0 && (
                  <>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: "#34D399",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: "#34D399",
                          letterSpacing: 0.8,
                          textTransform: "uppercase",
                        }}
                      >
                        Active right now
                      </Text>
                    </View>
                    <View style={{ gap: spacing.base, marginBottom: spacing.lg }}>
                      {activePeople.map((person) => (
                        <ProfileCard
                          key={person.id}
                          person={person}
                          variant="nearest"
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
                      ))}
                    </View>
                  </>
                )}

                {/* ── Everyone else ── */}
                {people.length > 0 && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.mutedText,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      marginBottom: spacing.sm,
                    }}
                  >
                    {sectionTitle}
                  </Text>
                )}

                <View style={{ gap: spacing.base }}>
                  {people.length ? (
                    people
                      .filter((p) => !p.checkin)
                      .map((person) => (
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
                        backgroundColor: colors.surfaceElevated,
                        borderRadius: radius.lg,
                        padding: spacing.base,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: colors.text,
                        }}
                      >
                        No one here yet
                      </Text>
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          color: colors.subtext,
                          lineHeight: 20,
                        }}
                      >
                        {showDevUi
                          ? "Go to Map → Demo to see what this looks like with a crowd."
                          : "Try the map, or check back soon as more people join."}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
