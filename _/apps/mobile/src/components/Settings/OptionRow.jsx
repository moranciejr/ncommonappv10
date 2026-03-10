import { Text, TouchableOpacity, View } from "react-native";
import { Check } from "lucide-react-native";
import { colors, radii, shadow, spacing, typography } from "@/utils/theme";

export function OptionRow({ title, subtitle, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: selected ? "rgba(250,204,21,0.4)" : colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        ...shadow.card,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, ...typography.body.mdBold }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {selected ? <Check size={18} color={colors.yellow} /> : null}
    </TouchableOpacity>
  );
}
