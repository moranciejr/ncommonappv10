import { useState, useEffect, useRef, useMemo } from "react";

export function useCheckinFormState(savedDefaults) {
  const [locationName, setLocationName] = useState("");
  const [note, setNote] = useState("");
  const [selectedInterest, setSelectedInterest] = useState(null);
  const [desiredGroupSize, setDesiredGroupSize] = useState(null);
  const [desiredGender, setDesiredGender] = useState("any");
  const [placeCoords, setPlaceCoords] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  const [placeAddress, setPlaceAddress] = useState("");

  // NEW: explicit plan start time (relative to "now")
  const [startOffsetMinutes, setStartOffsetMinutes] = useState(0);

  const defaultsAppliedRef = useRef(false);

  useEffect(() => {
    if (defaultsAppliedRef.current) {
      return;
    }

    const d = savedDefaults;
    if (!d) {
      return;
    }

    defaultsAppliedRef.current = true;

    if (
      d.defaultDesiredGroupSize === null ||
      typeof d.defaultDesiredGroupSize === "number"
    ) {
      setDesiredGroupSize(d.defaultDesiredGroupSize);
    }

    if (typeof d.defaultDesiredGender === "string") {
      setDesiredGender(d.defaultDesiredGender || "any");
    }
  }, [savedDefaults]);

  const resetForm = (defaults) => {
    setLocationName("");
    setNote("");
    setSelectedInterest(null);
    setDesiredGroupSize(
      defaults?.defaultDesiredGroupSize === null ||
        typeof defaults?.defaultDesiredGroupSize === "number"
        ? defaults.defaultDesiredGroupSize
        : null,
    );
    setDesiredGender(
      typeof defaults?.defaultDesiredGender === "string"
        ? defaults.defaultDesiredGender || "any"
        : "any",
    );
    setPlaceCoords(null);
    setPlaceId(null);
    setPlaceAddress("");
    setStartOffsetMinutes(0);
  };

  const handlePlacePick = (place) => {
    const lat = place?.lat;
    const lng = place?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      setPlaceCoords({ lat, lng });
    }
    setPlaceId(place?.placeId || null);
    setPlaceAddress(place?.formattedAddress || "");
  };

  const handleLocationNameChange = (text) => {
    setLocationName(text);
    setPlaceCoords(null);
    setPlaceId(null);
    setPlaceAddress("");
  };

  return {
    locationName,
    setLocationName,
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
  };
}

export function useExpiresLabel(defaultExpiresMinutes) {
  return useMemo(() => {
    const hours = defaultExpiresMinutes / 60;
    if (Number.isFinite(hours) && hours >= 1) {
      const rounded = Math.round(hours * 10) / 10;
      return `about ${rounded} hour${rounded === 1 ? "" : "s"}`;
    }
    return `${defaultExpiresMinutes} minutes`;
  }, [defaultExpiresMinutes]);
}
