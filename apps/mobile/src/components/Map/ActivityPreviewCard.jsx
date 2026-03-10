// Ticket 5 — Map callout / preview card (Apple Maps style)
import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, X } from "lucide-react-native";
import { theme } from "../../utils/theme";

export default function ActivityPreviewCard({
  visible,
  title = "Activity",
  subtitle = "Nearby",
  distanceLabel = "",
  categoryLabel = "",
  onClose,
  onView,
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 40,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  const bottomPad = Math.max(insets.bottom, theme.spacing.sm);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: theme.spacing.md,
        right: theme.spacing.md,
        bottom: bottomPad + 64, // keeps it above tab bar
        opacity,
        transform: [{ translateY }],
        zIndex: 60,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          overflow: "hidden",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.text,
                fontSize: 18,
                fontWeight: theme.fontWeights.bold,
                letterSpacing: 0.2,
              }}
            >
              {title}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                marginTop: 4,
                color: theme.colors.mutedText,
                fontSize: 13,
                fontWeight: theme.fontWeights.medium,
                letterSpacing: 0.2,
              }}
            >
              {compactMeta([categoryLabel, distanceLabel, subtitle])}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            hitSlop={10}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: theme.radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <X size={18} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={{ height: theme.spacing.md }} />

        <Pressable
          onPress={onView}
          accessibilityRole="button"
          accessibilityLabel="View activity"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.primary,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 15,
              fontWeight: theme.fontWeights.bold,
            }}
          >
            View
          </Text>
          <ChevronRight size={18} color={theme.colors.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function compactMeta(parts) {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" • ");
}
