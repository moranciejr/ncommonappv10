import { Text, TouchableOpacity, View } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function UpgradePrompt({ message, onUpgrade }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.xl,
          padding: 14,
          ...shadow.card,
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          Upgrade to keep exploring plans
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          {message ||
            "You've hit the free plan limit. Upgrade to keep browsing."}
        </Text>
        <TouchableOpacity
          onPress={onUpgrade}
          style={{
            marginTop: 12,
            backgroundColor: colors.primary,
            borderRadius: radii.lg,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.primaryText,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            Upgrade
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
