import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { withQuery } from "@/utils/queryString";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

// NEW: small helper for sorting by proximity (center is the search center).
function distanceKmBetween(a, b) {
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
}

export function useMapData({
  center,
  selectedInterest,
  radiusKm,
  distanceUnit,
}) {
  const queryClient = useQueryClient();
  const [seedError, setSeedError] = useState(null);
  const didAutoSeed = useRef(false);

  const onboardingQuery = useQuery({
    queryKey: ["onboardingStatus"],
    staleTime: 1000 * 60 * 5, // 5 min — onboarding status is stable
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch("/api/onboarding/status", { signal });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/onboarding/status, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const pointsQuery = useQuery({
    queryKey: [
      "mapPoints",
      { center, selectedInterest, radiusKm, distanceUnit },
    ],
    // IMPORTANT: allow 0 lat/lng (valid coordinates) — use Number.isFinite instead of truthy checks.
    enabled: Number.isFinite(center?.lat) && Number.isFinite(center?.lng),
    staleTime: 1000 * 30, // 30s — map data changes often but not every second
    queryFn: async () => {
      const safeRadius =
        typeof radiusKm === "number" && radiusKm > 0 ? radiusKm : 10;

      const url = withQuery("/api/map/points", {
        lat: center.lat,
        lng: center.lng,
        radiusKm: safeRadius,
        interest: selectedInterest || null,
        units: distanceUnit,
      });
      const response = await authedFetch(url, { timeoutMs: 20000, signal });
      const data = await readResponseBody(response);

      // For upgrade gating, treat 402 as a successful response so the UI can show a nice upgrade prompt
      // instead of a scary red error.
      if (response.status === 402) {
        return {
          ok: false,
          myInterests: data?.myInterests || [],
          hotspots: [],
          users: [],
          events: [],
          usage: data?.usage || null,
          upgradeNudge: data?.upgradeNudge || null,
        };
      }

      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching ${url}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      setSeedError(null);
      const response = await authedFetch("/api/dev/seed-demo", {
        method: "POST",
        timeoutMs: 20000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          count: 16,
          // NOTE: backend now refuses to seed in production; no force flag here.
        }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/dev/seed-demo, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
    },
    onError: (err) => {
      console.error(err);
      setSeedError("Could not create demo people. Try again.");
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, nextJoined }) => {
      const path = nextJoined
        ? `/api/events/${eventId}/join`
        : `/api/events/${eventId}/leave`;

      const response = await authedFetch(path, { method: "POST" });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching ${path}, the response was [${response.status}] ${msg}`,
        );
      }
      return { ok: true };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const myInterests = useMemo(() => {
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.slice(0, 12);
  }, [onboardingQuery.data?.onboarding?.interests]);

  const displayName =
    onboardingQuery.data?.onboarding?.profile?.displayName || "";

  const hotspots = useMemo(() => {
    const list = pointsQuery.data?.hotspots;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
  }, [pointsQuery.data?.hotspots]);

  const users = useMemo(() => {
    const list = pointsQuery.data?.users;
    if (!Array.isArray(list)) {
      return [];
    }

    const filtered = list.filter(
      (u) => Number.isFinite(u.lat) && Number.isFinite(u.lng),
    );

    // NEW: sort "Now"-style plans by nCommon first, then distance, then recency.
    // This makes the top of the list feel "smart".
    const centerPoint =
      center && Number.isFinite(center.lat) && Number.isFinite(center.lng)
        ? { lat: center.lat, lng: center.lng }
        : null;

    const sorted = [...filtered].sort((a, b) => {
      const aOverlap = typeof a?.overlapCount === "number" ? a.overlapCount : 0;
      const bOverlap = typeof b?.overlapCount === "number" ? b.overlapCount : 0;
      if (bOverlap !== aOverlap) {
        return bOverlap - aOverlap;
      }

      if (centerPoint) {
        const aDist = distanceKmBetween(centerPoint, {
          lat: a.lat,
          lng: a.lng,
        });
        const bDist = distanceKmBetween(centerPoint, {
          lat: b.lat,
          lng: b.lng,
        });
        if (
          Number.isFinite(aDist) &&
          Number.isFinite(bDist) &&
          aDist !== bDist
        ) {
          return aDist - bDist;
        }
      }

      // Prefer the explicit plan start time when available.
      const aTimeRaw = a?.startsAt || a?.createdAt;
      const bTimeRaw = b?.startsAt || b?.createdAt;

      const aTime = aTimeRaw ? new Date(aTimeRaw).getTime() : 0;
      const bTime = bTimeRaw ? new Date(bTimeRaw).getTime() : 0;
      return bTime - aTime;
    });

    return sorted;
  }, [center?.lat, center?.lng, pointsQuery.data?.users]);

  const events = useMemo(() => {
    const list = pointsQuery.data?.events;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));
  }, [pointsQuery.data?.events]);

  return {
    onboardingQuery,
    pointsQuery,
    seedMutation,
    rsvpMutation,
    myInterests,
    displayName,
    hotspots,
    users,
    events,
    seedError,
    didAutoSeed,
  };
}
