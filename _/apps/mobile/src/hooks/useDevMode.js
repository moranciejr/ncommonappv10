import { useEffect, useMemo } from "react";

export function useDevMode({
  hotspots,
  users,
  events,
  pointsQuery,
  seedMutation,
  didAutoSeed,
}) {
  const showDevActions = useMemo(() => {
    const devFlag =
      typeof globalThis !== "undefined" && globalThis
        ? Boolean(globalThis.__DEV__)
        : false;

    if (devFlag) {
      return true;
    }

    const createEnv = (process.env.EXPO_PUBLIC_CREATE_ENV || "").toLowerCase();
    const platformEnv = (process.env.ENV || "").toLowerCase();

    // Anything previews sometimes mark EXPO_PUBLIC_CREATE_ENV as production.
    // Keep dev actions on unless BOTH envs explicitly say production.
    return !(createEnv === "production" && platformEnv === "production");
  }, []);

  // Auto-seed once in dev if the map is empty (so you immediately see dummy profiles + check-ins).
  useEffect(() => {
    if (!showDevActions) {
      return;
    }
    if (didAutoSeed.current) {
      return;
    }
    if (!pointsQuery.isSuccess) {
      return;
    }

    const isEmpty = !hotspots.length && !users.length && !events.length;
    if (!isEmpty) {
      return;
    }

    didAutoSeed.current = true;
    seedMutation.mutate();
  }, [
    hotspots.length,
    events.length,
    pointsQuery.isSuccess,
    seedMutation,
    showDevActions,
    users.length,
    didAutoSeed,
  ]);

  return { showDevActions };
}
