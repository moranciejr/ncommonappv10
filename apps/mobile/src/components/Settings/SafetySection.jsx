import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, spacing, typography } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { ToggleRow } from "./ToggleRow";

export function SafetySection({
  isLoading,
  settings,
  savingProfileSettings,
  toggleOnlyVerified,
  toggleStrictMutual,
}) {
  const router = useRouter();

  const base =
    (typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_BASE_URL ||
        process.env.EXPO_PUBLIC_PROXY_BASE_URL
      : null) || null;

  const canOpen = !!(base || "").trim();

  const openSafetyTips = () => {
    if (!canOpen) {
      Alert.alert("Link unavailable", "Could not determine the website URL.");
      return;
    }
    router.push({ pathname: "/legal", params: { doc: "safety" } });
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Safety
      </Text>

      {isLoading ? (
        <View style={{ marginTop: spacing.md, alignItems: "center" }}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <ToggleRow
            title="Only show verified email users"
            subtitle="Filters discovery to people who verified their email."
            value={settings.onlyVerified}
            disabled={savingProfileSettings}
            onValueChange={toggleOnlyVerified}
          />

          <ToggleRow
            title="Strict mutual interests"
            subtitle="Only show people with at least one interest in common (nCommon feed)."
            value={settings.strictMutualInterests}
            disabled={savingProfileSettings}
            onValueChange={toggleStrictMutual}
            rightHint="nCommon"
          />

          <TouchableOpacity
            onPress={openSafetyTips}
            activeOpacity={0.9}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md,
              ...shadow.card,
            }}
          >
            <Text style={{ ...typography.body.mdBold, color: colors.text }}>
              Safety Tips
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.subtext,
                ...typography.body.smBold,
                lineHeight: 18,
              }}
            >
              How to meet and chat safely (18+ only).
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
