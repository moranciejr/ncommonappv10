import { Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { colors, shadow, spacing, typography } from "@/utils/theme";

export function SettingsHeader({ onBack }) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.base,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.85)",
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.card,
        }}
      >
        <ChevronLeft size={18} color={colors.text} />
      </TouchableOpacity>

      <Text style={{ ...typography.display.xs, color: colors.text }}>
        Settings
      </Text>

      <View style={{ width: 40, height: 40 }} />
    </View>
  );
}
