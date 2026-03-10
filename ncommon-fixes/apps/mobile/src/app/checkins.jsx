import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { CheckinHeader } from "@/components/Checkins/CheckinHeader";
import { CreatePlanForm } from "@/components/Checkins/CreatePlanForm";
import { LivePlansList } from "@/components/Checkins/LivePlansList";
import { useCheckinLocation } from "@/hooks/useCheckinLocation";
import { useCheckinQueries } from "@/hooks/useCheckinQueries";
import { useCheckinMutations } from "@/hooks/useCheckinMutations";
import {
  useCheckinFormState,
  useExpiresLabel,
} from "@/hooks/useCheckinFormState";
import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { useRequestJoin } from "@/hooks/useRequestJoin";
import { usePlanCta } from "@/hooks/usePlanCta";
import { darkTheme } from "@/utils/theme";
const { colors } = darkTheme;
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export default function CheckinsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [error, setError] = useState(null);

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["checkins"], ["onboardingStatus"], ["profileSettings"]],
    onRefresh: () => setError(null),
  });

  const deviceCoords = useCheckinLocation();
  const { onboardingQuery, checkinsQuery, profileSettingsQuery } =
    useCheckinQueries();

  const savedDefaults = profileSettingsQuery.data?.settings || null;

  const {
    locationName,
    note,
    setNote,
    selectedInterest,
    setSelectedInterest,
    desiredGroupSize,
    setDesiredGroupSize,
    desiredGender,
    setDesiredGender,
    placeCoords,
    placeId,
    placeAddress,
    startOffsetMinutes,
    setStartOffsetMinutes,
    resetForm,
    handlePlacePick,
    handleLocationNameChange,
  } = useCheckinFormState(savedDefaults);

  const {
    upgradePrompt,
    setUpgradePrompt,
    handleCreateSuccess,
    handleCreateError,
  } = useUpgradePrompt();

  const { requestJoinMutation } = useRequestJoin({ setUpgradePrompt });

  const { getCtaForPlan } = usePlanCta({
    requestJoinMutation,
    onChatOpenError: (msg) => setError(msg),
  });

  const defaultExpiresMinutes = useMemo(() => {
    const m = savedDefaults?.defaultPlanExpiresMinutes;
    if (typeof m === "number" && Number.isFinite(m) && m >= 15) {
      return m;
    }
    return 120;
  }, [savedDefaults?.defaultPlanExpiresMinutes]);

  const expiresLabel = useExpiresLabel(defaultExpiresMinutes);

  const { createMutation, endMutation } = useCheckinMutations({
    locationName,
    note,
    selectedInterest,
    desiredGroupSize,
    desiredGender,
    placeCoords,
    deviceCoords,
    placeId,
    placeAddress,
    defaultExpiresMinutes,
    startOffsetMinutes,
    onCreateSuccess: (data) => {
      setError(null);
      handleCreateSuccess(data, savedDefaults);
      resetForm(savedDefaults);
    },
    onCreateError: (err) => {
      const handled = handleCreateError(err);
      if (!handled) {
        setError(friendlyErrorMessage(err, "Could not post your plan."));
      }
    },
    onEndSuccess: () => {},
    onEndError: (err) => {
      setError(friendlyErrorMessage(err, "Could not end check-in."));
    },
  });

  const interestOptions = useMemo(() => {
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.slice(0, 10);
  }, [onboardingQuery.data?.onboarding?.interests]);

  const items = useMemo(() => {
    const list = checkinsQuery.data?.checkins;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [checkinsQuery.data?.checkins]);

  const myActivePlans = useMemo(() => {
    return items.filter((c) => c.isMine);
  }, [items]);

  const myActiveCount = myActivePlans.length;

  const onCreate = useCallback(() => {
    setError(null);
    if (!locationName.trim()) {
      setError("Please pick a place.");
      return;
    }
    if (!selectedInterest) {
      setError("Pick an interest so people find you on the map.");
      return;
    }
    createMutation.mutate();
  }, [createMutation, locationName, selectedInterest]);

  const openPlan = useCallback(
    (checkin) => {
      const id = checkin?.id;
      if (!id) {
        return;
      }
      router.push(`/plans/${id}`);
    },
    [router],
  );

  const groupSizeOptions = useMemo(() => [1, 2, 3, 4, 5], []);

  const onboardingLoadError = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your interests.",
    );
  }, [onboardingQuery.error]);

  const settingsLoadError = useMemo(() => {
    if (!profileSettingsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      profileSettingsQuery.error,
      "Could not load your plan defaults.",
    );
  }, [profileSettingsQuery.error]);

  const checkinsLoadError = useMemo(() => {
    if (!checkinsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(checkinsQuery.error, "Could not load plans.");
  }, [checkinsQuery.error]);

  const canRetry =
    !!checkinsQuery.error ||
    !!onboardingQuery.error ||
    !!profileSettingsQuery.error;

  const onRetryAll = useCallback(() => {
    setError(null);
    invalidateMany(queryClient, [
      ["checkins"],
      ["onboardingStatus"],
      ["profileSettings"],
    ]);
  }, [queryClient]);

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <CheckinHeader onBack={() => router.back()} />

          {error ? (
            <View
              style={{
                marginTop: 14,
                backgroundColor: "rgba(176,0,32,0.12)",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: "#FF6B6B", fontWeight: "800" }}>
                {error}
              </Text>
            </View>
          ) : null}

          <ErrorNotice
            message={onboardingLoadError || settingsLoadError}
            onRetry={canRetry ? onRetryAll : null}
            style={
              onboardingLoadError || settingsLoadError
                ? { marginTop: 14 }
                : null
            }
          />

          <CreatePlanForm
            interests={interestOptions}
            selectedInterest={selectedInterest}
            onSelectInterest={setSelectedInterest}
            locationName={locationName}
            onLocationNameChange={handleLocationNameChange}
            deviceCoords={deviceCoords}
            onPlacePick={handlePlacePick}
            note={note}
            onNoteChange={setNote}
            groupSizeOptions={groupSizeOptions}
            desiredGroupSize={desiredGroupSize}
            onSelectGroupSize={setDesiredGroupSize}
            desiredGender={desiredGender}
            onSelectGender={setDesiredGender}
            startOffsetMinutes={startOffsetMinutes}
            onSelectStartOffset={setStartOffsetMinutes}
            onSubmit={onCreate}
            isSubmitting={createMutation.isPending}
            myActivePlans={myActivePlans}
            myActiveCount={myActiveCount}
            onEndPlan={(id) => endMutation.mutate(id)}
            isEnding={endMutation.isPending}
            expiresLabel={expiresLabel}
          />

          <LivePlansList
            checkins={items}
            isLoading={checkinsQuery.isLoading}
            error={checkinsLoadError}
            onRetry={canRetry ? onRetryAll : null}
            onPlanPress={openPlan}
            getCtaForPlan={getCtaForPlan}
          />
        </ScrollView>

        <UpgradePromptModal
          visible={!!upgradePrompt}
          title={upgradePrompt?.title}
          message={upgradePrompt?.message}
          primaryText={upgradePrompt?.primaryCta || "Upgrade"}
          secondaryText={upgradePrompt?.secondaryCta || "Not now"}
          onPrimary={() => {
            const target = upgradePrompt?.target || "/upgrade";
            setUpgradePrompt(null);
            router.push(target);
          }}
          onClose={() => setUpgradePrompt(null)}
        />
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
