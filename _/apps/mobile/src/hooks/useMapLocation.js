import { useEffect, useState, useCallback, useMemo } from "react";
import * as Location from "expo-location";
import { clampNum } from "@/utils/formatUtils";
import { getInterestLabel, normalizeInterest } from "@/utils/interestTaxonomy";

// Austin launch core (Downtown / UT / South Congress)
const AUSTIN_HUBS = [
  { id: "downtown", name: "Downtown", lat: 30.2672, lng: -97.7431 },
  { id: "ut", name: "UT", lat: 30.285, lng: -97.739 },
  { id: "soco", name: "South Congress", lat: 30.25, lng: -97.751 },
];

// NEW: (lightweight) interest-to-hub scoring. This is intentionally
// opinionated and tuned for Austin launch density.
const HUB_INTEREST_HINTS = {
  downtown: new Set(
    [
      // music/nightlife
      "bar hopping",
      "dj / dance nights",
      "karaoke",
      "live concerts",
      "open mic",
      "sports bar",
      "jazz / blues shows",
      // food + social
      "restaurant hopping",
      "craft beer",
      "wine tasting",
      "trivia nights",
      // learning/networking
      "career networking",
      "coding meetups",
    ].map(normalizeInterest),
  ),
  ut: new Set(
    [
      // sports + fitness
      "pickleball",
      "tennis",
      "basketball",
      "running",
      "soccer",
      "volleyball",
      "cycling",
      "table tennis",
      "racquetball",
      "gym workouts",
      "martial arts",
      // learning/community
      "language exchange",
      "coding meetups",
      "career networking",
      // casual
      "board games",
    ].map(normalizeInterest),
  ),
  soco: new Set(
    [
      // wellness + chill
      "yoga / pilates",
      "meditation / mindfulness",
      "dance classes",
      // markets/shopping
      "farmer’s markets",
      "flea markets",
      "pop-up shops",
      "thrift stores",
      // arts
      "painting / drawing",
      "photography (studio, street)",
      "museum & gallery visits",
      // outdoors-lite
      "dog walking & park meetups",
      // food
      "food trucks",
    ].map(normalizeInterest),
  ),
};

function scoreHubsFromInterests(interests) {
  const scores = { downtown: 0, ut: 0, soco: 0 };
  const matches = { downtown: [], ut: [], soco: [] };

  if (!Array.isArray(interests) || interests.length === 0) {
    return { scores, matches };
  }

  // NEW: weight the user's top 1–2 interests higher than the rest.
  // We treat the first 2 items as "top" (the UI should keep important ones earlier).
  // This keeps the hub pick from getting diluted when a user has 10+ interests.
  const topCount = 2;

  for (let i = 0; i < interests.length; i += 1) {
    const raw = interests[i];
    const v = normalizeInterest(raw);
    if (!v) {
      continue;
    }

    const weight = i < topCount ? 3 : 1;

    for (const hubId of Object.keys(scores)) {
      const hintSet = HUB_INTEREST_HINTS[hubId];
      if (!hintSet) {
        continue;
      }
      if (hintSet.has(v)) {
        scores[hubId] += weight;
        // Keep matches list de-duped-ish so the reason is clean
        if (!matches[hubId].includes(v)) {
          matches[hubId].push(v);
        }
      }
    }
  }

  return { scores, matches };
}

function pickHubByInterests(interests) {
  const { scores, matches } = scoreHubsFromInterests(interests);

  const entries = Object.entries(scores);
  entries.sort((a, b) => b[1] - a[1]);

  const top = entries[0];
  const runnerUp = entries[1];

  const topId = top?.[0];
  const topScore = top?.[1] ?? 0;
  const runnerScore = runnerUp?.[1] ?? 0;

  // Require at least one strong hint, and avoid ties so we don't feel random.
  // NEW: because top interests are weighted, we can set a slightly higher bar
  // so we only "override" time-based defaults when the signal is real.
  if (!topId || topScore < 3 || topScore === runnerScore) {
    return null;
  }

  const hub = AUSTIN_HUBS.find((h) => h.id === topId) || null;
  if (!hub) {
    return null;
  }

  const topMatches = (matches[topId] || []).slice(0, 2);
  const reasonParts = topMatches
    .map((v) => getInterestLabel(v) || v)
    .filter(Boolean);

  const reason = reasonParts.length
    ? `your interests (${reasonParts.join(", ")})`
    : "your interests";

  return { hub, reason };
}

// NEW: pick a "smart" default hub based on day + time (+ optionally interests).
// Keep this simple and opinionated (launch vibes > perfect accuracy).
function getRecommendedAustinHub(now = new Date(), interests = null) {
  // 1) interests can override time when there’s strong signal.
  const interestPick = pickHubByInterests(interests);

  const day = now.getDay(); // 0=Sun
  const hour = now.getHours();

  const isWeekend = day === 0 || day === 6;
  const isThuFriSat = day === 4 || day === 5 || day === 6;

  // Time-based fallback (kept as-is)
  let timePick = {
    hub: AUSTIN_HUBS[0],
    reason: "recommended",
  };

  // Thu/Fri/Sat nights: downtown energy.
  // (>= 6pm OR before 2am)
  if (isThuFriSat && (hour >= 18 || hour < 2)) {
    timePick = {
      hub: AUSTIN_HUBS.find((h) => h.id === "downtown") || AUSTIN_HUBS[0],
      reason: "nightlife",
    };
  } else if (day === 0) {
    // Sunday
    if (hour >= 9 && hour < 15) {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "soco") || AUSTIN_HUBS[0],
        reason: "Sunday daytime",
      };
    } else {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "downtown") || AUSTIN_HUBS[0],
        reason: "Sunday evening",
      };
    }
  } else if (day === 6) {
    // Saturday
    if (hour >= 8 && hour < 13) {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "soco") || AUSTIN_HUBS[0],
        reason: "weekend morning",
      };
    } else {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "downtown") || AUSTIN_HUBS[0],
        reason: "weekend afternoon",
      };
    }
  } else if (!isWeekend) {
    // Weekday
    if (hour >= 7 && hour < 16) {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "ut") || AUSTIN_HUBS[0],
        reason: "daytime",
      };
    } else if (hour >= 16 && hour < 19) {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "downtown") || AUSTIN_HUBS[0],
        reason: "after work",
      };
    } else {
      timePick = {
        hub: AUSTIN_HUBS.find((h) => h.id === "downtown") || AUSTIN_HUBS[0],
        reason: "evening",
      };
    }
  }

  if (!interestPick) {
    return timePick;
  }

  // Blend reasons so the UI can explain “why”.
  const blendedReason = timePick?.reason
    ? `${interestPick.reason} + ${timePick.reason}`
    : interestPick.reason;

  return { hub: interestPick.hub, reason: blendedReason };
}

function buildAustinSoftLaunchNotice({
  showingName,
  recommendedName,
  recommendedReason,
}) {
  const safeShowing =
    typeof showingName === "string" && showingName.trim()
      ? showingName.trim()
      : "Central Austin";

  const safeRecommended =
    typeof recommendedName === "string" && recommendedName.trim()
      ? recommendedName.trim()
      : null;

  const safeReason =
    typeof recommendedReason === "string" && recommendedReason.trim()
      ? recommendedReason.trim()
      : null;

  const why = safeReason ? ` (${safeReason})` : "";

  const recommendedLine = safeRecommended
    ? ` Recommended right now: ${safeRecommended}${why}.`
    : "";

  return `Launching in Central Austin first — showing ${safeShowing}. You can still search anywhere.${recommendedLine}`;
}

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

function getNearestAustinHub(point) {
  let best = AUSTIN_HUBS[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const hub of AUSTIN_HUBS) {
    const d = distanceKmBetween(point, { lat: hub.lat, lng: hub.lng });
    if (d < bestDist) {
      bestDist = d;
      best = hub;
    }
  }

  return { hub: best, distanceKm: bestDist };
}

export function useMapLocation() {
  const [locationStatus, setLocationStatus] = useState({
    ready: false,
    error: null,
    notice: null,
    isOutsideLaunchArea: false,
    launchHubId: "downtown",
    launchHubName: "Downtown",
    // NEW: for "smart" UI labeling
    recommendedHubId: "downtown",
    recommendedHubName: "Downtown",
    recommendedHubReason: "recommended",
  });

  // NEW: keep interests here so we can refine recommendation after onboarding data loads.
  const [interestContext, setInterestContext] = useState([]);

  // "center" is the current data/query center for the map.
  const [center, setCenter] = useState({
    lat: 30.2672,
    lng: -97.7431,
  });

  // NEW: keep the user's actual location separate so we can offer a "My location" button
  // even after the user browses around.
  const [userLocation, setUserLocation] = useState(null);

  const launchHub = useMemo(() => {
    const id = locationStatus.launchHubId;
    const found = AUSTIN_HUBS.find((h) => h.id === id);
    return found || AUSTIN_HUBS[0];
  }, [locationStatus.launchHubId]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // NEW: compute once so the experience is stable while the app boots.
      // We may refine this later once interests load.
      const recommended = getRecommendedAustinHub(new Date(), null);
      const recommendedHub = recommended.hub;

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted) {
          return;
        }

        if (!perm?.granted) {
          setCenter({ lat: recommendedHub.lat, lng: recommendedHub.lng });
          setLocationStatus({
            ready: true,
            error: "Location permission is off. We're showing Central Austin.",
            notice: null,
            isOutsideLaunchArea: false,
            launchHubId: recommendedHub.id,
            launchHubName: recommendedHub.name,
            recommendedHubId: recommendedHub.id,
            recommendedHubName: recommendedHub.name,
            recommendedHubReason: recommended.reason,
          });
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) {
          return;
        }

        const lat = clampNum(current?.coords?.latitude, {
          min: -90,
          max: 90,
          fallback: 30.2672,
        });

        const lng = clampNum(current?.coords?.longitude, {
          min: -180,
          max: 180,
          fallback: -97.7431,
        });

        const nextUser = { lat, lng };
        setUserLocation(nextUser);

        const nearest = getNearestAustinHub(nextUser);
        const outside = nearest.distanceKm > 18;

        const initialHub = outside ? recommendedHub : nearest.hub;

        setLocationStatus({
          ready: true,
          error: null,
          notice: outside
            ? buildAustinSoftLaunchNotice({
                showingName: initialHub.name,
                recommendedName: recommendedHub.name,
                recommendedReason: recommended.reason,
              })
            : null,
          isOutsideLaunchArea: outside,
          launchHubId: initialHub.id,
          launchHubName: initialHub.name,
          recommendedHubId: recommendedHub.id,
          recommendedHubName: recommendedHub.name,
          recommendedHubReason: recommended.reason,
        });

        if (outside) {
          setCenter({ lat: initialHub.lat, lng: initialHub.lng });
        } else {
          setCenter(nextUser);
        }
      } catch (err) {
        console.error(err);
        if (!mounted) {
          return;
        }

        const recommended = getRecommendedAustinHub(new Date(), null);
        const recommendedHub = recommended.hub;

        setCenter({ lat: recommendedHub.lat, lng: recommendedHub.lng });
        setLocationStatus({
          ready: true,
          error: "Could not read your location. We're showing Central Austin.",
          notice: null,
          isOutsideLaunchArea: false,
          launchHubId: recommendedHub.id,
          launchHubName: recommendedHub.name,
          recommendedHubId: recommendedHub.id,
          recommendedHubName: recommendedHub.name,
          recommendedHubReason: recommended.reason,
        });
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  // NEW: refine the recommendation once we learn what the user is into.
  // We do *not* auto-move the map — we only update the "recommended" label + notice.
  useEffect(() => {
    if (!locationStatus?.ready) {
      return;
    }

    const recommended = getRecommendedAustinHub(new Date(), interestContext);
    const hub = recommended?.hub;

    if (!hub?.id) {
      return;
    }

    setLocationStatus((prev) => {
      if (!prev?.ready) {
        return prev;
      }

      // Avoid useless re-renders.
      if (
        prev.recommendedHubId === hub.id &&
        prev.recommendedHubReason === recommended.reason
      ) {
        return prev;
      }

      const outside = prev.isOutsideLaunchArea === true;

      return {
        ...prev,
        recommendedHubId: hub.id,
        recommendedHubName: hub.name,
        recommendedHubReason: recommended.reason,
        notice: outside
          ? buildAustinSoftLaunchNotice({
              showingName: prev.launchHubName,
              recommendedName: hub.name,
              recommendedReason: recommended.reason,
            })
          : prev.notice,
      };
    });
  }, [interestContext, locationStatus?.ready]);

  const recenterToUser = useCallback(() => {
    if (!userLocation) {
      return false;
    }
    setCenter(userLocation);
    return true;
  }, [userLocation]);

  const recenterToLaunchHub = useCallback(() => {
    if (!launchHub) {
      return false;
    }
    setCenter({ lat: launchHub.lat, lng: launchHub.lng });
    return true;
  }, [launchHub]);

  // NEW: allow the user to jump between Austin launch hubs (Downtown / UT / SoCo)
  // without changing whether they are "outside" the launch area.
  const selectLaunchHub = useCallback((hubId) => {
    const id = typeof hubId === "string" ? hubId.trim() : "";
    if (!id) {
      return false;
    }
    const found = AUSTIN_HUBS.find((h) => h.id === id);
    if (!found) {
      return false;
    }

    setCenter({ lat: found.lat, lng: found.lng });
    setLocationStatus((prev) => {
      const outside = prev?.isOutsideLaunchArea === true;
      const recommendedName = prev?.recommendedHubName;
      const recommendedReason = prev?.recommendedHubReason;

      return {
        ...prev,
        launchHubId: found.id,
        launchHubName: found.name,
        notice: outside
          ? buildAustinSoftLaunchNotice({
              showingName: found.name,
              recommendedName,
              recommendedReason,
            })
          : prev.notice,
      };
    });

    return true;
  }, []);

  return {
    locationStatus,
    center,
    setCenter,
    userLocation,
    recenterToUser,
    recenterToLaunchHub,
    selectLaunchHub,
    launchHub,
    launchHubs: AUSTIN_HUBS,
    // NEW: let the map screen feed interests in once onboarding data loads
    setInterestContext,
  };
}
