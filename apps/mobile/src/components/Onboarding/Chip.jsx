import { Text, TouchableOpacity } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : colors.chipBg;
  const color = selected ? colors.primaryText : colors.chipText;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
      }}
    >
      <Text
        style={{
          color,
          ...typography.label.md,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
