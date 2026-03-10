// Ticket 2 — Map header redesign (declutter + consistent controls)
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Search,
  SlidersHorizontal,
  LocateFixed,
  MoreHorizontal,
} from "lucide-react-native";
import { theme } from "../../utils/theme";

export default function MapHeader({
  name = "",
  onPressSearch,
  onPressFilters,
  onPressLocate,
  onPressOverflow,
}) {
  const insets = useSafeAreaInsets();
  const greeting = getGreeting(name);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: Math.max(insets.top, theme.spacing.sm),
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        zIndex: 50,
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        pointerEvents="box-none"
      >
        <View
          style={{ flex: 1, paddingRight: theme.spacing.sm }}
          pointerEvents="none"
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: theme.colors.text,
              fontSize: 20,
              fontWeight: theme.fontWeights.semibold,
              letterSpacing: 0.2,
            }}
          >
            {greeting}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              marginTop: 2,
              color: theme.colors.mutedText,
              fontSize: 13,
              fontWeight: theme.fontWeights.regular,
              letterSpacing: 0.2,
            }}
          >
            Activities and people around you
          </Text>
        </View>

        <View
          style={{ flexDirection: "row", alignItems: "center" }}
          pointerEvents="box-none"
        >
          <CircleButton
            icon={Search}
            onPress={onPressSearch}
            accessibilityLabel="Search"
          />
          <Spacer />
          <CircleButton
            icon={SlidersHorizontal}
            onPress={onPressFilters}
            accessibilityLabel="Filters"
          />
          <Spacer />
          <CircleButton
            icon={LocateFixed}
            onPress={onPressLocate}
            accessibilityLabel="Locate me"
          />
          <Spacer />
          <CircleButton
            icon={MoreHorizontal}
            onPress={onPressOverflow}
            accessibilityLabel="More"
          />
        </View>
      </View>
    </View>
  );
}

function Spacer() {
  return <View style={{ width: theme.spacing.xs }} />;
}

function CircleButton({ icon: Icon, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: theme.radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.controlBg,
        borderWidth: 1,
        borderColor: theme.colors.controlBorder,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={20} color={theme.colors.text} />
    </Pressable>
  );
}

// Ticket 6 — "Hey, Mickie" personalization + fallback
function getGreeting(name) {
  const safe = (name || "").trim();
  if (!safe) return "Hey there,";
  const first = safe.split(" ")[0] || safe;
  const trimmed = first.length > 20 ? first.slice(0, 19) + "…" : first;
  return `Hey, ${trimmed}`;
}
