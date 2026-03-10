import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react-native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { colors, radii, shadow } from "@/utils/theme";
import { useAuth } from "@/utils/auth/useAuth";
import {
  useArchiveHabit,
  useCreateHabit,
  useProductivityHabits,
  useToggleHabitDone,
} from "@/hooks/useProductivity";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";

function toDayLabel(isoDate) {
  if (typeof isoDate !== "string") {
    return "";
  }
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d
    .toLocaleDateString(undefined, {
      weekday: "short",
    })
    .toUpperCase();
}

const CATEGORY_CHOICES = [
  { key: "general", label: "General" },
  { key: "work", label: "Work" },
  { key: "study", label: "Study" },
  { key: "fitness", label: "Fitness" },
  { key: "health", label: "Health" },
  { key: "mind", label: "Mind" },
];

export default function ProductivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady, isAuthenticated, signIn } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");

  const focusedPadding = 16;
  const paddingAnimation = useRef(
    new Animated.Value(insets.bottom + focusedPadding),
  ).current;

  const animateTo = useCallback(
    (value) => {
      Animated.timing(paddingAnimation, {
        toValue: value,
        duration: 200,
        useNativeDriver: false,
      }).start();
    },
    [paddingAnimation],
  );

  const handleInputFocus = useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    animateTo(focusedPadding);
  }, [animateTo]);

  const handleInputBlur = useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    animateTo(insets.bottom + focusedPadding);
  }, [animateTo, insets.bottom]);

  const habitsQuery = useProductivityHabits();
  const createMutation = useCreateHabit();
  const toggleMutation = useToggleHabitDone();
  const archiveMutation = useArchiveHabit();

  const habits = useMemo(() => {
    const list = habitsQuery.data?.habits;
    return Array.isArray(list) ? list : [];
  }, [habitsQuery.data?.habits]);

  const summary = habitsQuery.data?.summary || null;
  const week = Array.isArray(summary?.week) ? summary.week : [];

  const errorMessage = useMemo(() => {
    if (!habitsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      habitsQuery.error,
      "Could not load your tracker.",
    );
  }, [habitsQuery.error]);

  const onAddHabit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    createMutation.mutate(
      { title: trimmed, category },
      {
        onSuccess: () => {
          setTitle("");
        },
        onError: (err) => {
          console.error(err);
          Alert.alert("Could not add", "Please try again.");
        },
      },
    );
  }, [category, createMutation, title]);

  const onToggleHabit = useCallback(
    (habit) => {
      const habitId = habit?.id;
      if (!habitId) {
        return;
      }
      toggleMutation.mutate(
        { habitId, done: !habit.doneToday },
        {
          onError: (err) => {
            console.error(err);
            Alert.alert("Could not update", "Please try again.");
          },
        },
      );
    },
    [toggleMutation],
  );

  const onArchiveHabit = useCallback(
    (habit) => {
      const habitId = habit?.id;
      if (!habitId) {
        return;
      }

      Alert.alert("Remove habit?", "This hides it from your list.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            archiveMutation.mutate(
              { habitId, isArchived: true },
              {
                onError: (err) => {
                  console.error(err);
                  Alert.alert("Could not remove", "Please try again.");
                },
              },
            );
          },
        },
      ]);
    },
    [archiveMutation],
  );

  const doneToday = Number(summary?.doneToday || 0);
  const totalHabits = Number(summary?.totalHabits || habits.length || 0);
  const progressText = totalHabits ? `${doneToday}/${totalHabits} done` : "";

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingHorizontal: 20,
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
          Productivity Tracker
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          Sign in to track your daily habits.
        </Text>

        <TouchableOpacity
          onPress={() => signIn()}
          style={{
            marginTop: 14,
            backgroundColor: colors.primary,
            borderRadius: radii.button,
            paddingVertical: 14,
            alignItems: "center",
            ...shadow.card,
          }}
        >
          <Text
            style={{
              color: colors.primaryText,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            Sign in
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
    >
      <Animated.View
        style={{
          flex: 1,
          paddingBottom: paddingAnimation,
        }}
      >
        <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 10,
              paddingBottom: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(255,255,255,0.92)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "900",
                  color: colors.text,
                }}
                numberOfLines={1}
              >
                Productivity
              </Text>
              {progressText ? (
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    fontWeight: "800",
                    color: colors.subtext,
                  }}
                >
                  {progressText}
                </Text>
              ) : null}
            </View>

            <View style={{ width: 42 }} />
          </View>

          {/* Week chart */}
          <View
            style={{
              marginTop: 6,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 12,
              ...shadow.card,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Last 7 days
            </Text>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-end",
              }}
            >
              {week.length ? (
                week.map((d) => {
                  const label = toDayLabel(d.date);
                  const count = Number(d.doneCount || 0);
                  const max = Math.max(1, totalHabits);
                  const barHeight = 8 + Math.round((count / max) * 34);

                  return (
                    <View
                      key={`day-${d.date}`}
                      style={{ flex: 1, alignItems: "center" }}
                    >
                      <View
                        style={{
                          width: "100%",
                          height: barHeight,
                          borderRadius: 10,
                          backgroundColor:
                            count > 0 ? colors.primary : "rgba(0,0,0,0.08)",
                        }}
                      />
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 10,
                          fontWeight: "900",
                          color: colors.subtext,
                        }}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                  No data yet.
                </Text>
              )}
            </View>
          </View>

          {/* Add habit */}
          <View
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 12,
              ...shadow.card,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Add a habit
            </Text>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Drink water, 10 min walk, no doomscroll…"
                  placeholderTextColor={"rgba(0,0,0,0.35)"}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onSubmitEditing={onAddHabit}
                  returnKeyType="done"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={onAddHabit}
                disabled={!title.trim() || createMutation.isPending}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !title.trim() || createMutation.isPending ? 0.5 : 1,
                }}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Plus color={colors.primaryText} size={20} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10, flexGrow: 0 }}
            >
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CATEGORY_CHOICES.map((c) => {
                  const selected = c.key === category;
                  return (
                    <TouchableOpacity
                      key={`cat-${c.key}`}
                      onPress={() => setCategory(c.key)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: selected
                          ? "rgba(0,0,0,0.92)"
                          : "rgba(0,0,0,0.06)",
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? "#fff" : colors.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
            Today
          </Text>

          {habitsQuery.isLoading ? (
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : habits.length ? (
            <View style={{ marginTop: 10, gap: 10 }}>
              {habits.map((h) => {
                const done = !!h.doneToday;
                const streakText = h.streak ? `${h.streak} day streak` : "";

                return (
                  <TouchableOpacity
                    key={`habit-${h.id}`}
                    onPress={() => onToggleHabit(h)}
                    disabled={toggleMutation.isPending}
                    style={{
                      backgroundColor: done
                        ? "rgba(27, 181, 120, 0.10)"
                        : colors.card,
                      borderWidth: 1,
                      borderColor: done
                        ? "rgba(27, 181, 120, 0.25)"
                        : colors.border,
                      borderRadius: radii.card,
                      padding: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      ...shadow.card,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 10, flex: 1 }}>
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: done
                            ? "rgba(27, 181, 120, 0.9)"
                            : "rgba(0,0,0,0.18)",
                          backgroundColor: done
                            ? "rgba(27, 181, 120, 0.9)"
                            : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {done ? <Check size={16} color="#fff" /> : null}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontWeight: "900",
                            color: colors.text,
                            fontSize: 14,
                          }}
                          numberOfLines={1}
                        >
                          {h.title}
                        </Text>
                        <View
                          style={{
                            marginTop: 3,
                            flexDirection: "row",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "900",
                              color: colors.subtext,
                            }}
                          >
                            {(h.category || "general").toUpperCase()}
                          </Text>

                          {streakText ? (
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "900",
                                color: done
                                  ? "rgba(27, 181, 120, 0.95)"
                                  : colors.subtext,
                              }}
                            >
                              {streakText}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => onArchiveHabit(h)}
                      disabled={archiveMutation.isPending}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.10)",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: archiveMutation.isPending ? 0.6 : 1,
                      }}
                    >
                      <Trash2 size={18} color={colors.subtext} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                marginTop: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.card,
                padding: 14,
              }}
            >
              <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                Add your first habit above.
              </Text>
            </View>
          )}

          <ErrorNotice
            message={errorMessage}
            onRetry={() => habitsQuery.refetch()}
            style={errorMessage ? { marginTop: 12 } : null}
          />
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingAnimatedView>
  );
}
