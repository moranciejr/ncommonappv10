import { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { Star, MoreHorizontal } from "lucide-react-native";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const { colors, spacing, typography, radius } = darkTheme;

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

function PersonCard({ person, onUnstar, isToggling, onBlock }) {
  const name = person.displayName || "Someone";
  const initials = initialsFromName(name);
  const hasAvatar = !!person.avatarUrl;

  const avatarNode = hasAvatar ? (
    <Image
      source={{ uri: person.avatarUrl }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
    />
  ) : (
    <Text
      style={{
        ...typography.label.lg,
        color: colors.text,
      }}
    >
      {initials}
    </Text>
  );

  const interests = Array.isArray(person.interests) ? person.interests : [];
  const interestText = interests.length
    ? interests
        .slice(0, 6)
        .map((x) => getInterestLabel(x) || x)
        .join(" · ")
    : "";

  const subtitleParts = [];
  if (person.city) {
    subtitleParts.push(person.city);
  }
  if (person.state) {
    subtitleParts.push(person.state);
  }
  const subtitle = subtitleParts.join(", ");

  const confirmBlock = useCallback(() => {
    const nameForUi = person.displayName || "this user";
    Alert.alert(
      `Block ${nameForUi}?`,
      "They will disappear from your map and lists, and messaging will be blocked.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => onBlock?.(person.id),
        },
      ],
    );
  }, [onBlock, person.displayName, person.id]);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.lg,
        padding: spacing.base,
      }}
    >
      <View
        style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.pill,
            overflow: "hidden",
            backgroundColor: colors.chipBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarNode}
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <Text
              style={{
                ...typography.body.lg,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              {name}
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <TouchableOpacity
                onPress={() => onUnstar(person.id)}
                disabled={isToggling}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isToggling ? 0.6 : 1,
                }}
              >
                <Star size={18} color={colors.yellow} fill={colors.yellow} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmBlock}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MoreHorizontal size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {subtitle ? (
            <Text
              style={{
                marginTop: spacing.xs,
                ...typography.label.md,
                color: colors.subtext,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {person.bio ? (
        <Text
          style={{
            marginTop: spacing.md,
            ...typography.body.md,
            color: colors.text,
            lineHeight: spacing.lg,
          }}
        >
          {person.bio}
        </Text>
      ) : null}

      {interestText ? (
        <Text
          style={{
            marginTop: spacing.md,
            ...typography.label.md,
            color: colors.subtext,
            lineHeight: spacing.base,
          }}
        >
          {interestText}
        </Text>
      ) : null}
    </View>
  );
}

export default function StarsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [error, setError] = useState(null);

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["stars"]],
    onRefresh: () => setError(null),
  });

  const starsQuery = useQuery({
    queryKey: ["stars"],
    queryFn: async () => {
      const response = await authedFetch("/api/stars");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/stars, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 1000 * 15,
  });

  const users = useMemo(() => {
    const list = starsQuery.data?.users;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [starsQuery.data?.users]);

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
      await queryClient.cancelQueries({ queryKey: ["stars"] });
      const previous = queryClient.getQueryData(["stars"]);

      queryClient.setQueryData(["stars"], (old) => {
        const list = old?.users;
        if (!Array.isArray(list)) {
          return old;
        }
        return { ...old, users: list.filter((u) => u.id !== targetUserId) };
      });

      return { previous };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      setError("Could not block user.");
      if (ctx?.previous) {
        queryClient.setQueryData(["stars"], ctx.previous);
      }
    },
    onSuccess: () => {
      Alert.alert("Blocked", "They won’t show up for you anymore.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const handleBlockUser = useCallback(
    (targetUserId) => {
      if (!targetUserId || blockMutation.isPending) {
        return;
      }
      blockMutation.mutate({ targetUserId });
    },
    [blockMutation],
  );

  const unstarMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const response = await authedFetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/stars, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onMutate: async (targetUserId) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: ["stars"] });
      const previous = queryClient.getQueryData(["stars"]);

      queryClient.setQueryData(["stars"], (old) => {
        const list = old?.users;
        if (!Array.isArray(list)) {
          return old;
        }
        return { ...old, users: list.filter((u) => u.id !== targetUserId) };
      });

      return { previous };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      setError("Could not update star.");
      if (ctx?.previous) {
        queryClient.setQueryData(["stars"], ctx.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
    },
  });

  const errorMessage = useMemo(() => {
    if (error) {
      return error;
    }
    if (!starsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(starsQuery.error, "Could not load your Stars.");
  }, [error, starsQuery.error]);

  const onRetry = useCallback(() => {
    setError(null);
    invalidateMany(queryClient, [["stars"]]);
  }, [queryClient]);

  const canRetry = !!starsQuery.error;

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
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
            paddingBottom: insets.bottom + 140,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              marginTop: spacing.base,
              ...typography.display.sm,
              color: colors.text,
            }}
          >
            Stars
          </Text>
          <Text
            style={{
              marginTop: spacing.sm,
              ...typography.body.md,
              color: colors.subtext,
              lineHeight: spacing.lg,
            }}
          >
            Favorites you can come back to anytime.
          </Text>

          <ErrorNotice
            message={errorMessage}
            onRetry={canRetry ? onRetry : null}
            style={errorMessage ? { marginTop: spacing.base } : null}
          />

          {starsQuery.isLoading ? (
            <View style={{ alignItems: "center", marginTop: spacing.lg }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : (
            <View style={{ marginTop: spacing.base, gap: spacing.md }}>
              {users.length ? (
                users.map((u) => (
                  <PersonCard
                    key={u.id}
                    person={u}
                    isToggling={unstarMutation.isPending}
                    onUnstar={(id) => unstarMutation.mutate(id)}
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
                      ...typography.body.lg,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    No favorites yet
                  </Text>
                  <Text
                    style={{
                      marginTop: spacing.sm,
                      ...typography.body.md,
                      color: colors.subtext,
                      lineHeight: spacing.lg,
                    }}
                  >
                    Star someone from nCommon or Nearest.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
