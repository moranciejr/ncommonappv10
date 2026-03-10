import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

const DEFAULT_SETTINGS = {
  appearOffline: false,
  hideDistance: false,
  showAge: false,
  hideMinors: false,
  onlyVerified: false,
  strictMutualInterests: false,
  notifPlanViews: true,
  notifNearbyPlans: true,
  notifJoinRequests: true,
  notifRequestUpdates: true,
  notifMessages: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  defaultPlanExpiresMinutes: 120,
  defaultDesiredGroupSize: null,
  defaultDesiredGender: "any",
};

export function useProfileSettings() {
  const queryClient = useQueryClient();

  const profileSettingsQuery = useQuery({
    queryKey: ["profileSettings"],
    staleTime: 1000 * 60, // 60s — settings rarely change, no need to refetch on every mount
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch("/api/profile/settings", { signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/profile/settings, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const settings = profileSettingsQuery.data?.settings || DEFAULT_SETTINGS;

  const updateSettingsMutation = useMutation({
    mutationFn: async (patch) => {
      const response = await authedFetch("/api/profile/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/profile/settings (POST), the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["profileSettings"] });
      const previous = queryClient.getQueryData(["profileSettings"]);

      queryClient.setQueryData(["profileSettings"], (old) => {
        const oldSettings = old?.settings || {};
        const nextSettings = { ...oldSettings, ...patch };
        return { ...(old || {}), settings: nextSettings };
      });

      return { previous };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      if (ctx?.previous) {
        queryClient.setQueryData(["profileSettings"], ctx.previous);
      }
      Alert.alert("Could not save", "Please try again.");
    },
    onSuccess: async (_data, patch) => {
      // Always refresh settings and onboarding status.
      await queryClient.invalidateQueries({ queryKey: ["profileSettings"] });
      await queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });

      // Only re-fetch map/nearby data when a setting that actually filters
      // those results has changed (appearOffline, hideMinors, onlyVerified,
      // strictMutualInterests). Toggling notifications or quiet hours has no
      // effect on what the map/nearby queries return.
      const MAP_AFFECTING_KEYS = new Set([
        "appearOffline",
        "hideMinors",
        "onlyVerified",
        "strictMutualInterests",
      ]);
      const affectsMap = Object.keys(patch).some((k) => MAP_AFFECTING_KEYS.has(k));
      if (affectsMap) {
        await queryClient.invalidateQueries({ queryKey: ["nearby"] });
        await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
        await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      }
    },
  });

  const savingProfileSettings = updateSettingsMutation.isPending;

  const toggleAppearOffline = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ appearOffline: next });
    },
    [updateSettingsMutation],
  );

  const toggleHideDistance = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ hideDistance: next });
    },
    [updateSettingsMutation],
  );

  const toggleShowAge = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ showAge: next });
    },
    [updateSettingsMutation],
  );

  const toggleOnlyVerified = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ onlyVerified: next });
    },
    [updateSettingsMutation],
  );

  const toggleStrictMutual = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ strictMutualInterests: next });
    },
    [updateSettingsMutation],
  );

  const toggleNotifJoinRequests = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ notifJoinRequests: next });
    },
    [updateSettingsMutation],
  );

  const toggleNotifRequestUpdates = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ notifRequestUpdates: next });
    },
    [updateSettingsMutation],
  );

  const toggleNotifMessages = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ notifMessages: next });
    },
    [updateSettingsMutation],
  );

  const toggleNotifPlanViews = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ notifPlanViews: next });
    },
    [updateSettingsMutation],
  );

  const toggleNotifNearbyPlans = useCallback(
    (next) => {
      updateSettingsMutation.mutate({ notifNearbyPlans: next });
    },
    [updateSettingsMutation],
  );

  const setDefaultPlanExpiresMinutes = useCallback(
    (minutes) => {
      updateSettingsMutation.mutate({ defaultPlanExpiresMinutes: minutes });
    },
    [updateSettingsMutation],
  );

  const setDefaultDesiredGroupSize = useCallback(
    (n) => {
      updateSettingsMutation.mutate({ defaultDesiredGroupSize: n });
    },
    [updateSettingsMutation],
  );

  const setDefaultDesiredGender = useCallback(
    (g) => {
      updateSettingsMutation.mutate({ defaultDesiredGender: g });
    },
    [updateSettingsMutation],
  );

  const setQuietHoursPreset = useCallback(
    (preset) => {
      if (preset === "none") {
        updateSettingsMutation.mutate({ quietHoursStart: 0, quietHoursEnd: 0 });
        return;
      }
      if (preset === "night") {
        updateSettingsMutation.mutate({
          quietHoursStart: 22,
          quietHoursEnd: 8,
        });
        return;
      }
      if (preset === "late") {
        updateSettingsMutation.mutate({
          quietHoursStart: 23,
          quietHoursEnd: 7,
        });
        return;
      }
    },
    [updateSettingsMutation],
  );

  const quietPreset = useMemo(() => {
    if (settings.quietHoursStart === 0 && settings.quietHoursEnd === 0) {
      return "none";
    }
    if (settings.quietHoursStart === 22 && settings.quietHoursEnd === 8) {
      return "night";
    }
    if (settings.quietHoursStart === 23 && settings.quietHoursEnd === 7) {
      return "late";
    }
    return "custom";
  }, [settings.quietHoursStart, settings.quietHoursEnd]);

  return {
    settings,
    isLoading: profileSettingsQuery.isLoading,
    error: profileSettingsQuery.error,
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
  };
}
