import { View, Text, TouchableOpacity, Alert } from "react-native";
import { colors } from "@/utils/theme";

export function ActivePlansList({ plans, onEndPlan, isEnding }) {
  if (!plans.length) {
    return null;
  }

  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      {plans.slice(0, 3).map((p) => (
        <View
          key={`mine-${p.id}`}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 12,
            backgroundColor: colors.background,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontWeight: "900",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {p.locationName}
            </Text>
            {p.note ? (
              <Text
                style={{
                  marginTop: 4,
                  color: colors.subtext,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {p.note}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "End plan?",
                "This will remove your pin from the map.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "End",
                    style: "destructive",
                    onPress: () => onEndPlan(p.id),
                  },
                ],
              );
            }}
            disabled={isEnding}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isEnding ? 0.6 : 1,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.text }}>End</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
