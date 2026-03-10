import { Text, TextInput, View } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  onFocus,
  onBlur,
}) {
  const height = multiline ? 110 : 46;

  return (
    <View style={{ marginBottom: spacing.base }}>
      <Text
        style={{
          ...typography.label.lg,
          color: colors.text,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtext}
        multiline={multiline}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.base,
          paddingTop: spacing.base,
          paddingBottom: spacing.base,
          height,
          backgroundColor: colors.surface,
          color: colors.text,
          ...typography.body.md,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
