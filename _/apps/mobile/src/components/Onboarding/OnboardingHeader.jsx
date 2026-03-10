import { Text, View } from "react-native";
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { lightTheme } from "@/utils/theme";

const { colors, typography, spacing } = lightTheme;

const LOGO_URL =
  "https://ucarecdn.com/18f829eb-8fe4-47a8-89b0-239a243cefa5/-/format/auto/";

export function OnboardingHeader({ headerText, subText, step }) {
  const { width } = useWindowDimensions();

  // The logo file is a wordmark, so giving it a square box makes it look tiny.
  // Make it roughly the same visual weight as the page title.
  const logoStyle = useMemo(() => {
    const w = width || 390;
    const maxWidth = Math.max(300, Math.min(420, w - 44));
    const height = Math.max(100, Math.min(160, Math.round(maxWidth * 0.4)));
    return { width: maxWidth, height };
  }, [width]);

  return (
    <>
      <View style={{ alignItems: "center", marginBottom: spacing.base }}>
        <Image
          source={{ uri: LOGO_URL }}
          style={logoStyle}
          contentFit="contain"
        />
        <Text
          style={{
            marginTop: spacing.sm,
            ...typography.heading.xl,
            color: colors.purple,
            textAlign: "center",
          }}
        >
          {headerText}
        </Text>
        <Text
          style={{
            marginTop: spacing.sm,
            ...typography.body.mdBold,
            color: colors.subtext,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          {subText}
        </Text>
      </View>

      <View
        style={{
          alignSelf: "center",
          marginBottom: spacing.md,
          backgroundColor: colors.chipBg,
          borderRadius: 999,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.sm,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            color: colors.purple,
            ...typography.label.sm,
          }}
        >
          Step {step + 1} of 3
        </Text>
      </View>
    </>
  );
}
