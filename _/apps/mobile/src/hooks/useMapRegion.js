import { useMemo } from "react";

export function useMapRegion({ center, region }) {
  const mapRegion = useMemo(() => {
    const safeLat = Number.isFinite(center?.lat) ? center.lat : 30.2672;
    const safeLng = Number.isFinite(center?.lng) ? center.lng : -97.7431;

    return {
      latitude: safeLat,
      longitude: safeLng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [center?.lat, center?.lng]);

  const visibleRegion = region || mapRegion;

  const radiusKm = useMemo(() => {
    const d = visibleRegion?.latitudeDelta;
    if (!d || !Number.isFinite(d)) {
      return 10;
    }
    const approx = (d * 111) / 2;
    const rounded = Math.round(approx);
    return Math.max(3, Math.min(120, rounded));
  }, [visibleRegion?.latitudeDelta]);

  return {
    mapRegion,
    visibleRegion,
    radiusKm,
  };
}
