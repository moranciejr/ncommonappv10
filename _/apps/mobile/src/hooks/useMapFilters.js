import { useMemo } from "react";

export function useMapFilters({
  selectedInterest,
  visibleRegion,
  onlyNow,
  hotspots,
  events,
  users,
  pinFilters,
}) {
  const showUserPins = useMemo(() => {
    if (selectedInterest) {
      return true;
    }
    if (!visibleRegion?.latitudeDelta) {
      return false;
    }
    return visibleRegion.latitudeDelta < 0.055;
  }, [selectedInterest, visibleRegion?.latitudeDelta]);

  const showEventPins = useMemo(() => {
    if (onlyNow) {
      return true;
    }
    if (selectedInterest) {
      return true;
    }
    if (!visibleRegion?.latitudeDelta) {
      return true;
    }
    return visibleRegion.latitudeDelta < 0.075;
  }, [onlyNow, selectedInterest, visibleRegion?.latitudeDelta]);

  const filteredHotspots = useMemo(() => {
    if (onlyNow) {
      return [];
    }
    return hotspots;
  }, [hotspots, onlyNow]);

  const filteredEvents = useMemo(() => {
    if (!onlyNow) {
      return events;
    }
    return (events || []).filter((e) => e?.isHappeningNow);
  }, [events, onlyNow]);

  const visibleHotspots = pinFilters.hotspots && !onlyNow;
  const visibleEvents = pinFilters.events && showEventPins;
  const visiblePeople = pinFilters.people && (onlyNow || showUserPins);

  const maxUserMarkers = useMemo(() => {
    if (selectedInterest) {
      return 60;
    }
    const d = visibleRegion?.latitudeDelta;
    if (!d) {
      return 30;
    }
    if (d > 0.08) {
      return 18;
    }
    if (d > 0.06) {
      return 26;
    }
    if (d > 0.045) {
      return 38;
    }
    return 60;
  }, [selectedInterest, visibleRegion?.latitudeDelta]);

  const maxEventMarkers = useMemo(() => {
    if (selectedInterest) {
      return 60;
    }
    const d = visibleRegion?.latitudeDelta;
    if (!d) {
      return 40;
    }
    if (d > 0.08) {
      return 22;
    }
    if (d > 0.06) {
      return 32;
    }
    if (d > 0.045) {
      return 44;
    }
    return 60;
  }, [selectedInterest, visibleRegion?.latitudeDelta]);

  const markerUsers = useMemo(() => {
    if (!Array.isArray(users)) {
      return [];
    }
    return users.slice(0, maxUserMarkers);
  }, [maxUserMarkers, users]);

  const markerEvents = useMemo(() => {
    if (!Array.isArray(filteredEvents)) {
      return [];
    }
    return filteredEvents.slice(0, maxEventMarkers);
  }, [filteredEvents, maxEventMarkers]);

  return {
    showUserPins,
    showEventPins,
    filteredHotspots,
    filteredEvents,
    visibleHotspots,
    visibleEvents,
    visiblePeople,
    markerUsers,
    markerEvents,
  };
}
