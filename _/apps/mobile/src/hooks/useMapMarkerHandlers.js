import { useCallback } from "react";

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function useMapMarkerHandlers({
  mapRef,
  setSelectedInterest,
  setSelectedCard,
  openSheet,
}) {
  const handleHotspotPress = useCallback(
    (h) => {
      setSelectedInterest(h.interest);
      setSelectedCard({ type: "hotspot", data: h });
      openSheet(1);
    },
    [setSelectedInterest, setSelectedCard, openSheet],
  );

  const handleUserMarkerPress = useCallback(
    (u) => {
      setSelectedInterest(u.interest);
      setSelectedCard({ type: "user", data: u });
      openSheet(1);

      const lat = toFiniteNumber(u?.lat);
      const lng = toFiniteNumber(u?.lng);

      if (lat === null || lng === null) {
        return;
      }

      try {
        if (
          mapRef.current &&
          typeof mapRef.current.animateToRegion === "function"
        ) {
          mapRef.current.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            },
            350,
          );
        }
      } catch (err) {
        console.error(err);
      }
    },
    [setSelectedInterest, setSelectedCard, openSheet, mapRef],
  );

  const handleEventPress = useCallback(
    (e) => {
      setSelectedInterest(e.interest);
      setSelectedCard({ type: "event", data: e });
      openSheet(2);

      const lat = toFiniteNumber(e?.lat);
      const lng = toFiniteNumber(e?.lng);

      if (lat === null || lng === null) {
        return;
      }

      try {
        if (
          mapRef.current &&
          typeof mapRef.current.animateToRegion === "function"
        ) {
          mapRef.current.animateToRegion(
            {
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            },
            350,
          );
        }
      } catch (err) {
        console.error(err);
      }
    },
    [setSelectedInterest, setSelectedCard, openSheet, mapRef],
  );

  return {
    handleHotspotPress,
    handleUserMarkerPress,
    handleEventPress,
  };
}
