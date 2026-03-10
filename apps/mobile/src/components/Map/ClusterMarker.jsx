// Ticket 4 — Cluster markers for overlapping pins
import React from "react";
import { View, Text } from "react-native";
import { Marker } from "react-native-maps";
import { theme } from "../../utils/theme";

export default function ClusterMarker({ coordinate, count = 2, onPress }) {
  if (!coordinate) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.clusterBg,
          borderWidth: 1,
          borderColor: theme.colors.clusterBorder,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: theme.colors.clusterShadow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            right: 3,
            bottom: 3,
            borderRadius: theme.radius.pill,
            borderWidth: 2,
            borderColor: theme.colors.primaryMuted,
          }}
        />
        <Text
          style={{
            color: theme.colors.text,
            fontSize: 15,
            fontWeight: theme.fontWeights.bold,
            letterSpacing: 0.2,
          }}
        >
          {label}
        </Text>
      </View>
    </Marker>
  );
}
