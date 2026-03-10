import { useCallback } from "react";
import { Alert } from "react-native";

export function useMapActions({
  mapRef,
  visibleRegion,
  userLocation,
  launchHub,
  launchHubs,
  setCenter,
  setHasMovedMap,
  setSelectedCard,
  closeSheet,
  recenterToUser,
  recenterToLaunchHub,
  selectLaunchHub,
}) {
  const distanceKmBetween = useCallback((a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h =
      sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return R * c;
  }, []);

  const applySearchThisArea = useCallback(() => {
    const regionLat = visibleRegion?.latitude;
    const regionLng = visibleRegion?.longitude;

    if (!Number.isFinite(regionLat) || !Number.isFinite(regionLng)) {
      return;
    }

    setSelectedCard(null);
    closeSheet();

    const nextRegion = {
      latitude: regionLat,
      longitude: regionLng,
      latitudeDelta: visibleRegion.latitudeDelta ?? 0.08,
      longitudeDelta: visibleRegion.longitudeDelta ?? 0.08,
    };

    setCenter({ lat: nextRegion.latitude, lng: nextRegion.longitude });
    setHasMovedMap(false);

    try {
      if (
        mapRef.current &&
        typeof mapRef.current.animateToRegion === "function"
      ) {
        mapRef.current.animateToRegion(nextRegion, 250);
      }
    } catch (err) {
      console.error(err);
    }
  }, [
    closeSheet,
    setCenter,
    setSelectedCard,
    visibleRegion?.latitude,
    visibleRegion?.longitude,
    visibleRegion?.latitudeDelta,
    visibleRegion?.longitudeDelta,
    setHasMovedMap,
    mapRef,
  ]);

  const onPressMyLocation = useCallback(() => {
    if (!userLocation) {
      Alert.alert(
        "Location unavailable",
        "We couldn't read your location yet. Check permissions and try again.",
      );
      return;
    }

    setSelectedCard(null);
    closeSheet();

    const ok = recenterToUser();
    if (!ok) {
      Alert.alert(
        "Location unavailable",
        "We couldn't read your location yet. Check permissions and try again.",
      );
      return;
    }

    setHasMovedMap(false);

    try {
      if (
        mapRef.current &&
        typeof mapRef.current.animateToRegion === "function"
      ) {
        mapRef.current.animateToRegion(
          {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
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
    closeSheet,
    recenterToUser,
    setSelectedCard,
    userLocation,
    setHasMovedMap,
    mapRef,
  ]);

  const onPressCentralAustin = useCallback(
    (hubId) => {
      const requestedId = typeof hubId === "string" ? hubId.trim() : "";

      let targetHub = launchHub;
      let ok = true;

      if (requestedId) {
        const found = (launchHubs || []).find((h) => h.id === requestedId);
        if (found) {
          targetHub = found;
        }
        ok = selectLaunchHub(requestedId);
      } else {
        ok = recenterToLaunchHub();
      }

      if (!ok) {
        return;
      }

      setSelectedCard(null);
      closeSheet();
      setHasMovedMap(false);

      const hubLat = targetHub?.lat;
      const hubLng = targetHub?.lng;
      if (!Number.isFinite(hubLat) || !Number.isFinite(hubLng)) {
        return;
      }

      try {
        if (
          mapRef.current &&
          typeof mapRef.current.animateToRegion === "function"
        ) {
          mapRef.current.animateToRegion(
            {
              latitude: hubLat,
              longitude: hubLng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            },
            450,
          );
        }
      } catch (err) {
        console.error(err);
      }
    },
    [
      closeSheet,
      launchHub,
      launchHubs,
      recenterToLaunchHub,
      selectLaunchHub,
      setSelectedCard,
      setHasMovedMap,
      mapRef,
    ],
  );

  return {
    distanceKmBetween,
    applySearchThisArea,
    onPressMyLocation,
    onPressCentralAustin,
  };
}
