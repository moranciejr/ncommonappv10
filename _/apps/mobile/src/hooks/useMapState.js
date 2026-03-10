import { useState, useRef, useMemo } from "react";

export function useMapState() {
  const [selectedInterest, setSelectedInterest] = useState(null);
  const [region, setRegion] = useState(null);
  const [pinFilters, setPinFilters] = useState({
    events: true,
    people: true,
    hotspots: true,
  });
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [hasMovedMap, setHasMovedMap] = useState(false);

  const didInitialAutoCenterRef = useRef(false);
  const lastUpgradeReasonRef = useRef(null);
  const hasSeenInitialRegionRef = useRef(false);

  return {
    selectedInterest,
    setSelectedInterest,
    region,
    setRegion,
    pinFilters,
    setPinFilters,
    upgradePrompt,
    setUpgradePrompt,
    hasMovedMap,
    setHasMovedMap,
    didInitialAutoCenterRef,
    lastUpgradeReasonRef,
    hasSeenInitialRegionRef,
  };
}
