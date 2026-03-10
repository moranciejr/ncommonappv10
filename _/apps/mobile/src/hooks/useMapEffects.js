import { useEffect } from "react";

export function useMapEffects({
  mapRef,
  center,
  locationStatus,
  didInitialAutoCenterRef,
  pointsQuery,
  lastUpgradeReasonRef,
  setUpgradePrompt,
  setInterestContext,
  myInterests,
}) {
  useEffect(() => {
    if (didInitialAutoCenterRef.current) {
      return;
    }
    if (!locationStatus.ready || locationStatus.error) {
      return;
    }

    didInitialAutoCenterRef.current = true;

    try {
      if (
        mapRef.current &&
        typeof mapRef.current.animateToRegion === "function"
      ) {
        mapRef.current.animateToRegion(
          {
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          },
          450,
        );
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    locationStatus.ready,
    locationStatus.error,
    center.lat,
    center.lng,
    didInitialAutoCenterRef,
    mapRef,
  ]);

  useEffect(() => {
    const nudge = pointsQuery.data?.upgradeNudge;
    if (!nudge) {
      return;
    }
    const reason = typeof nudge?.reason === "string" ? nudge.reason : "";
    if (reason && lastUpgradeReasonRef.current === reason) {
      return;
    }
    lastUpgradeReasonRef.current = reason || "_shown";
    setUpgradePrompt(nudge);
  }, [pointsQuery.data?.upgradeNudge, lastUpgradeReasonRef, setUpgradePrompt]);

  useEffect(() => {
    if (typeof setInterestContext !== "function") {
      return;
    }
    setInterestContext(myInterests);
  }, [myInterests, setInterestContext]);
}
