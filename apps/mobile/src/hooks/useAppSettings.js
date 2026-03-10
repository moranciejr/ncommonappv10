import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const DISTANCE_UNIT_KEY = "appSettings:distanceUnit";
const MAP_ONLY_NOW_KEY = "appSettings:mapOnlyNow";

// Supported units:
// - "mi" (miles)
// - "km" (kilometers)
export function useDistanceUnit() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["appSettings", "distanceUnit"],
    staleTime: Infinity, // local AsyncStorage — only invalidated by mutation
    queryFn: async ({ signal } = {}) => {
      const value = await AsyncStorage.getItem(DISTANCE_UNIT_KEY);
      if (value === "km" || value === "mi") {
        return value;
      }
      return "mi";
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextUnit) => {
      const safe = nextUnit === "km" ? "km" : "mi";
      await AsyncStorage.setItem(DISTANCE_UNIT_KEY, safe);
      return safe;
    },
    onSuccess: (nextUnit) => {
      queryClient.setQueryData(["appSettings", "distanceUnit"], nextUnit);
    },
  });

  const unit = query.data || "mi";

  const setUnit = useCallback(
    (nextUnit) => {
      mutation.mutate(nextUnit);
    },
    [mutation],
  );

  return {
    unit,
    isLoading: query.isLoading,
    error: query.error,
    setUnit,
    isSaving: mutation.isPending,
  };
}

// Map filter preference:
// - true: show only "happening now" items
// - false: show all times
export function useMapOnlyNow() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["appSettings", "mapOnlyNow"],
    staleTime: Infinity, // local AsyncStorage — only invalidated by mutation
    queryFn: async ({ signal } = {}) => {
      const value = await AsyncStorage.getItem(MAP_ONLY_NOW_KEY);
      if (value === "1") {
        return true;
      }
      if (value === "0") {
        return false;
      }
      return false;
    },
  });

  const mutation = useMutation({
    mutationFn: async (next) => {
      const safe = !!next;
      await AsyncStorage.setItem(MAP_ONLY_NOW_KEY, safe ? "1" : "0");
      return safe;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["appSettings", "mapOnlyNow"], next);
    },
  });

  const onlyNow = !!query.data;

  const setOnlyNow = useCallback(
    (next) => {
      mutation.mutate(!!next);
    },
    [mutation],
  );

  return {
    onlyNow,
    isLoading: query.isLoading,
    error: query.error,
    setOnlyNow,
    isSaving: mutation.isPending,
  };
}

const KM_TO_MI = 0.621371;

export function formatDistanceFromKm(km, unit) {
  const safeKm = typeof km === "number" && Number.isFinite(km) ? km : 0;
  const safeUnit = unit === "km" ? "km" : "mi";

  if (safeUnit === "km") {
    const roundedKm = Math.round(safeKm);
    const label = roundedKm === 1 ? "km" : "km";
    return `${roundedKm} ${label}`;
  }

  const miles = safeKm * KM_TO_MI;
  const roundedMiles = Math.round(miles);
  const label = roundedMiles === 1 ? "mile" : "miles";
  return `${roundedMiles} ${label}`;
}

export function approxDistanceLabelFromKm(km, unit) {
  return `~${formatDistanceFromKm(km, unit)}`;
}
