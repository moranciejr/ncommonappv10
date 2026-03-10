import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, shadow } from "@/utils/theme";
import { StarterChip } from "./StarterChip";

export function IcebreakersSection({ icebreakers, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  const visibleCount = expanded ? 10 : 4;

  const visibleIcebreakers = useMemo(() => {
    if (!Array.isArray(icebreakers)) {
      return [];
    }
    return icebreakers.slice(0, visibleCount);
  }, [icebreakers, visibleCount]);

  const hasMore =
    Array.isArray(icebreakers) && icebreakers.length > visibleCount;

  return (
    <View
      style={{
        marginBottom: 12,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: 12,
        ...shadow.card,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "900",
            color: colors.primary,
            flex: 1,
          }}
          numberOfLines={1}
        >
          Cool icebreakers
        </Text>

        {expanded ? (
          <TouchableOpacity
            onPress={() => setExpanded(false)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.035)",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}
            >
              Less
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text
        style={{
          marginTop: 6,
          fontSize: 12,
          fontWeight: "700",
          color: colors.subtext,
          lineHeight: 16,
        }}
      >
        Tap to drop one in.
      </Text>

      <ScrollView
        horizontal
        style={{ marginTop: 10, flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingRight: 6 }}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {visibleIcebreakers.map((t) => (
          <StarterChip key={t} label={t} onPress={() => onSelect(t)} />
        ))}

        {hasMore && !expanded ? (
          <TouchableOpacity
            onPress={() => setExpanded(true)}
            style={{
              backgroundColor: colors.chipBg,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}
            >
              More ideas
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
