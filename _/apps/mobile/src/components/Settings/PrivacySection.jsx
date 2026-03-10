import { ActivityIndicator, Text, View } from "react-native";
import { colors, spacing, typography } from "@/utils/theme";
import { ToggleRow } from "./ToggleRow";

export function PrivacySection({
  isLoading,
  error,
  settings,
  savingProfileSettings,
  toggleHideDistance,
  toggleShowAge,
  toggleAppearOffline,
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Privacy
      </Text>

      {isLoading ? (
        <View style={{ marginTop: spacing.md, alignItems: "center" }}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <ToggleRow
            title="Hide distance"
            subtitle="Other people won't see how far away you are."
            value={settings.hideDistance}
            disabled={savingProfileSettings}
            onValueChange={toggleHideDistance}
          />

          <ToggleRow
            title="Show my age"
            subtitle="If off, your age won't appear on your profile cards."
            value={settings.showAge}
            disabled={savingProfileSettings}
            onValueChange={toggleShowAge}
          />

          <ToggleRow
            title="Hide me from browsing"
            subtitle="You won't show up in nCommon / Nearest lists. You can still show up when you post a plan."
            value={settings.appearOffline}
            disabled={savingProfileSettings}
            onValueChange={toggleAppearOffline}
          />

          {error ? (
            <View
              style={{
                backgroundColor: colors.dangerBg,
                borderRadius: spacing.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              <Text
                style={{ color: colors.dangerText, ...typography.body.mdBold }}
              >
                Could not load privacy settings.
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
