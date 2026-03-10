import { Switch, Text, View } from "react-native";
import { colors, radii, shadow, spacing, typography } from "@/utils/theme";

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  rightHint,
}) {
  const borderColor = disabled ? "rgba(0,0,0,0.08)" : colors.border;
  const opacity = disabled ? 0.55 : 1;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor,
        borderRadius: radii.card,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        ...shadow.card,
        opacity,
      }}
    >
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <Text style={{ color: colors.text, ...typography.body.mdBold }}>
            {title}
          </Text>
          {rightHint ? (
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 999,
                backgroundColor: colors.mutedBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  ...typography.body.smBold,
                  color: colors.subtext,
                }}
              >
                {rightHint}
              </Text>
            </View>
          ) : null}
        </View>

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

      <Switch
        value={!!value}
        onValueChange={disabled ? undefined : onValueChange}
        disabled={disabled}
      />
    </View>
  );
}
