import { Text, TouchableOpacity } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function PrimaryButton({ title, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: radius.md,
        alignItems: "center",
        opacity: disabled ? 0.6 : 1,
        ...shadow.card,
      }}
    >
      <Text
        style={{
          color: colors.primaryText,
          ...typography.label.lg,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
