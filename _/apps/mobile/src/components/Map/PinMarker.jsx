// Ticket 4 — Map pins system (consistent + selectable)
import React, { useMemo } from "react";
import { View } from "react-native";
import { Marker } from "react-native-maps";
import {
  MapPin,
  Dumbbell,
  Music,
  Utensils,
  Gamepad2,
  BookOpen,
  Trees,
  Users,
} from "lucide-react-native";
import { theme } from "../../utils/theme";

export default function PinMarker({
  id,
  coordinate,
  category = "Other",
  title,
  selected = false,
  onPress,
  zIndex = 1,
}) {
  const ringColor = useMemo(() => getCategoryColor(category), [category]);
  const Icon = useMemo(() => getCategoryIcon(category), [category]);

  if (!coordinate) return null;

  return (
    <Marker
      identifier={String(id || title || Math.random())}
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={false}
      zIndex={selected ? 999 : zIndex}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: selected ? 1.1 : 1.0 }],
        }}
      >
        {/* Pin body */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.pinInner,
            borderWidth: 2,
            borderColor: selected
              ? theme.colors.pinSelectedStroke
              : theme.colors.pinStroke,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: theme.colors.pinShadow,
            shadowOpacity: 1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          {/* Category ring */}
          <View
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              right: 2,
              bottom: 2,
              borderRadius: theme.radius.pill,
              borderWidth: 3,
              borderColor: ringColor,
              opacity: 0.95,
            }}
          />
          <Icon size={18} color={theme.colors.text} />
        </View>

        {/* Pin tail */}
        <View
          style={{
            width: 12,
            height: 12,
            backgroundColor: theme.colors.pinInner,
            borderLeftWidth: selected ? 2 : 1,
            borderBottomWidth: selected ? 2 : 1,
            borderColor: selected
              ? theme.colors.pinSelectedStroke
              : theme.colors.pinStroke,
            transform: [{ rotate: "45deg" }],
            marginTop: -6,
            borderRadius: 2,
          }}
        />
      </View>
    </Marker>
  );
}

function getCategoryColor(category) {
  const c = String(category || "").toLowerCase();

  if (theme.colors.pin[c]) return theme.colors.pin[c];

  if (
    c.includes("sport") ||
    c.includes("fitness") ||
    c.includes("pickle") ||
    c.includes("golf")
  )
    return theme.colors.pin.sports;
  if (c.includes("music")) return theme.colors.pin.music;
  if (
    c.includes("food") ||
    c.includes("drink") ||
    c.includes("bar") ||
    c.includes("restaurant")
  )
    return theme.colors.pin.food;
  if (c.includes("game") || c.includes("gaming"))
    return theme.colors.pin.gaming;
  if (c.includes("read") || c.includes("book")) return theme.colors.pin.reading;
  if (
    c.includes("outdoor") ||
    c.includes("hike") ||
    c.includes("trail") ||
    c.includes("camp")
  )
    return theme.colors.pin.outdoor;

  return theme.colors.pin.other;
}

function getCategoryIcon(category) {
  const c = String(category || "").toLowerCase();
  if (
    c.includes("sport") ||
    c.includes("fitness") ||
    c.includes("pickle") ||
    c.includes("golf")
  )
    return Dumbbell;
  if (c.includes("music")) return Music;
  if (
    c.includes("food") ||
    c.includes("drink") ||
    c.includes("bar") ||
    c.includes("restaurant")
  )
    return Utensils;
  if (c.includes("game") || c.includes("gaming")) return Gamepad2;
  if (c.includes("read") || c.includes("book")) return BookOpen;
  if (
    c.includes("outdoor") ||
    c.includes("hike") ||
    c.includes("trail") ||
    c.includes("camp")
  )
    return Trees;
  if (c.includes("people") || c.includes("group")) return Users;
  return MapPin;
}
