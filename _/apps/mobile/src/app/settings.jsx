import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radii, spacing, typography } from "@/utils/theme";
import { useDistanceUnit } from "@/hooks/useAppSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfileSettings } from "@/hooks/useProfileSettings";
import { useAccountActions } from "@/hooks/useAccountActions";
import { SettingsHeader } from "@/components/Settings/SettingsHeader";
import { DistanceUnitsSection } from "@/components/Settings/DistanceUnitsSection";
import { SafetySection } from "@/components/Settings/SafetySection";
import { PrivacySection } from "@/components/Settings/PrivacySection";
import { LegalSection } from "@/components/Settings/LegalSection";
import { PlanDefaultsSection } from "@/components/Settings/PlanDefaultsSection";
import { AlertsSection } from "@/components/Settings/AlertsSection";
import { AccountSection } from "@/components/Settings/AccountSection";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { tier } = useSubscription();
  const isFree = tier === "free";

  const { unit, isLoading, setUnit, isSaving } = useDistanceUnit();

  const {
    settings,
    isLoading: profileSettingsLoading,
    error: profileSettingsError,
    savingProfileSettings,
    quietPreset,
    toggleAppearOffline,
    toggleHideDistance,
    toggleShowAge,
    toggleOnlyVerified,
    toggleStrictMutual,
    toggleNotifJoinRequests,
    toggleNotifRequestUpdates,
    toggleNotifMessages,
    toggleNotifPlanViews,
    toggleNotifNearbyPlans,
    setDefaultPlanExpiresMinutes,
    setDefaultDesiredGroupSize,
    setDefaultDesiredGender,
    setQuietHoursPreset,
  } = useProfileSettings();

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["profileSettings"], ["billingStatus"]],
  });

  const { clearActivityMutation, deleteAccountMutation } = useAccountActions();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: insets.top }} />

      <SettingsHeader onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={refreshControl}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingTop: spacing.base,
        }}
        showsVerticalScrollIndicator={false}
      >
        <DistanceUnitsSection
          unit={unit}
          isLoading={isLoading}
          isSaving={isSaving}
          setUnit={setUnit}
        />

        <SafetySection
          isLoading={profileSettingsLoading}
          settings={settings}
          savingProfileSettings={savingProfileSettings}
          toggleOnlyVerified={toggleOnlyVerified}
          toggleStrictMutual={toggleStrictMutual}
        />

        <PrivacySection
          isLoading={profileSettingsLoading}
          error={profileSettingsError}
          settings={settings}
          savingProfileSettings={savingProfileSettings}
          toggleHideDistance={toggleHideDistance}
          toggleShowAge={toggleShowAge}
          toggleAppearOffline={toggleAppearOffline}
        />

        {/* New: Terms + Privacy links (App Store launch requirement) */}
        <LegalSection />

        <PlanDefaultsSection
          settings={settings}
          setDefaultPlanExpiresMinutes={setDefaultPlanExpiresMinutes}
          setDefaultDesiredGroupSize={setDefaultDesiredGroupSize}
          setDefaultDesiredGender={setDefaultDesiredGender}
        />

        <AlertsSection
          isFree={isFree}
          settings={settings}
          savingProfileSettings={savingProfileSettings}
          quietPreset={quietPreset}
          onUpgradePress={() => router.push("/upgrade")}
          toggleNotifPlanViews={toggleNotifPlanViews}
          toggleNotifNearbyPlans={toggleNotifNearbyPlans}
          toggleNotifJoinRequests={toggleNotifJoinRequests}
          toggleNotifRequestUpdates={toggleNotifRequestUpdates}
          toggleNotifMessages={toggleNotifMessages}
          setQuietHoursPreset={setQuietHoursPreset}
        />

        <AccountSection
          clearActivityMutation={clearActivityMutation}
          deleteAccountMutation={deleteAccountMutation}
        />

        <View
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.mutedBg,
            borderRadius: radii.card,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <Text
            style={{
              color: colors.subtext,
              ...typography.body.mdBold,
              lineHeight: 18,
            }}
          >
            Next: we can add custom quiet hours, verified-badge visuals, and
            more safety tools.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
