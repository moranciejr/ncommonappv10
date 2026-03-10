import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { PROVIDER_GOOGLE } from "react-native-maps";
import { friendlyErrorMessage } from "@/utils/errors";

export function useMapProvider() {
  return useMemo(() => {
    if (Platform.OS === "android") {
      return PROVIDER_GOOGLE;
    }
    return undefined;
  }, []);
}

export function useMapErrors({
  locationStatus,
  pointsQuery,
  onboardingQuery,
  seedError,
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
    return unsub;
  }, []);

  const networkErrorBanner = isOffline
    ? "You're offline. Check your connection."
    : null;

  const pointsErrorBanner = useMemo(() => {
    if (!pointsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(pointsQuery.error, "Could not load the map.");
  }, [pointsQuery.error]);

  const onboardingErrorBanner = useMemo(() => {
    if (!onboardingQuery?.error) {
      return null;
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your profile.",
    );
  }, [onboardingQuery?.error]);

  const errorBanner = networkErrorBanner
    ? networkErrorBanner
    : locationStatus.error
      ? locationStatus.error
      : pointsErrorBanner
        ? pointsErrorBanner
        : onboardingErrorBanner
          ? onboardingErrorBanner
          : seedError;

  return { errorBanner };
}

export function useSearchThisArea({
  hasMovedMap,
  center,
  visibleRegion,
  distanceKmBetween,
}) {
  const movedDistanceKm = useMemo(() => {
    const regionLat = visibleRegion?.latitude;
    const regionLng = visibleRegion?.longitude;

    if (!Number.isFinite(regionLat) || !Number.isFinite(regionLng)) {
      return 0;
    }

    if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) {
      return 0;
    }

    return distanceKmBetween(
      { lat: center.lat, lng: center.lng },
      { lat: regionLat, lng: regionLng },
    );
  }, [
    center?.lat,
    center?.lng,
    distanceKmBetween,
    visibleRegion?.latitude,
    visibleRegion?.longitude,
  ]);

  const shouldShowSearchThisArea = useMemo(() => {
    if (!hasMovedMap) {
      return false;
    }
    return movedDistanceKm > 0.7;
  }, [hasMovedMap, movedDistanceKm]);

  return { shouldShowSearchThisArea };
}
