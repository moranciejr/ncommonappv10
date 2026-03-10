import { useCallback } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, typography, radii, spacing } = darkTheme;

function Avatar({ uri, name, size = 44 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceElevated,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.primaryText, fontSize: size * 0.35, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * MeetupsList
 *
 * Displays the mutual meetup list on a profile.
 * Shows avatar + name in a wrapped grid, with a "Would meet again" indicator.
 *
 * Props:
 *   meetups   — array of { userId, displayName, avatarUrl, wouldMeetAgain }
 *   onPress   — called with userId when a person is tapped
 *   isLoading — show skeleton state
 */
export function MeetupsList({ meetups = [], onPress, isLoading }) {
  const handlePress = useCallback(
    (userId) => {
      if (typeof onPress === "function") onPress(userId);
    },
    [onPress],
  );

  if (isLoading) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, paddingVertical: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            style={{
              alignItems: "center",
              gap: 6,
              opacity: 0.4,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.surfaceElevated,
              }}
            />
            <View
              style={{
                width: 40,
                height: 10,
                borderRadius: 4,
                backgroundColor: colors.surfaceElevated,
              }}
            />
          </View>
        ))}
      </View>
    );
  }

  if (!meetups.length) return null;

  return (
    <View>
      {/* Section header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ ...typography.label.md, color: colors.subtext }}>
          People I've met ({meetups.length})
        </Text>
      </View>

      {/* Avatar grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {meetups.map((m) => (
          <TouchableOpacity
            key={m.userId}
            onPress={() => handlePress(m.userId)}
            activeOpacity={0.75}
            style={{ alignItems: "center", gap: 4 }}
          >
            <View>
              <Avatar uri={m.avatarUrl} name={m.displayName} size={48} />
              {m.wouldMeetAgain && (
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    width: 18,
                    height: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 10 }}>⭐</Text>
                </View>
              )}
            </View>
            <Text
              style={{
                ...typography.label.xs,
                color: colors.subtext,
                maxWidth: 52,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {m.displayName?.split(" ")[0] || ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
