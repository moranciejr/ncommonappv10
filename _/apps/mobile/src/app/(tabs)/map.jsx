import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView from "react-native-maps";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMapLocation } from "@/hooks/useMapLocation";
import { useMapData } from "@/hooks/useMapData";
import { useMapInteractions } from "@/hooks/useMapInteractions";
import { useDevMode } from "@/hooks/useDevMode";
import { useDistanceUnit, useMapOnlyNow } from "@/hooks/useAppSettings";
import { useAuth } from "@/utils/auth/useAuth";
import { invalidateMany } from "@/utils/retryQueries";
import { useMapState } from "@/hooks/useMapState";
import { useMapRegion } from "@/hooks/useMapRegion";
import { useMapFilters } from "@/hooks/useMapFilters";
import { useMapActions } from "@/hooks/useMapActions";
import { useMapMarkerHandlers } from "@/hooks/useMapMarkerHandlers";
import { useBlockUser } from "@/hooks/useBlockUser";
import { useRequestJoin } from "@/hooks/useRequestJoin";
import { usePlanCta } from "@/hooks/usePlanCta";
import { useMessageEventHost } from "@/hooks/useMessageEventHost";
import { useMapEffects } from "@/hooks/useMapEffects";
import {
  useMapProvider,
  useMapErrors,
  useSearchThisArea,
} from "@/utils/mapUtils";
import {
  HotspotMarkers,
  UserMarkers,
  EventMarkers,
  MyLocationMarker,
} from "@/components/Map/MapMarkers";
import { MapOverlay } from "@/components/Map/MapOverlay";
import { MapBottomSheet } from "@/components/Map/MapBottomSheet";
import { EmptyMapNotice } from "@/components/Map/EmptyMapNotice";
import { DemoButton } from "@/components/Map/DemoButton";
import { darkTheme } from "@/utils/theme";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { EventsList } from "@/components/Map/EventsList";
import { UsersList } from "@/components/Map/UsersList";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useInterestArt } from "@/hooks/useInterestArt";

const { colors, spacing, typography, radius } = darkTheme;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef(null);

  const focusParam = useMemo(() => {
    const raw = params?.focus;
    if (Array.isArray(raw)) {
      return raw[0] || null;
    }
    return typeof raw === "string" ? raw : null;
  }, [params?.focus]);

  const focusNonce = useMemo(() => {
    const raw = params?.focusNonce;
    if (Array.isArray(raw)) {
      return raw[0] || null;
    }
    return typeof raw === "string" ? raw : null;
  }, [params?.focusNonce]);

  const lastHandledFocusNonceRef = useRef(null);

  const [overlayExpanded, setOverlayExpanded] = useState(false);

  const { refreshControl: webRefreshControl } = usePullToRefresh({
    queryKeys: [["mapPoints"], ["onboardingStatus"]],
  });

  const {
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
  } = useMapState();

  const { onlyNow, setOnlyNow } = useMapOnlyNow();

  const {
    locationStatus,
    center,
    setCenter,
    userLocation,
    recenterToUser,
    recenterToLaunchHub,
    selectLaunchHub,
    launchHub,
    launchHubs,
    setInterestContext,
  } = useMapLocation();

  const { mapRegion, visibleRegion, radiusKm } = useMapRegion({
    center,
    region,
  });

  const { unit: distanceUnit } = useDistanceUnit();

  const {
    pointsQuery,
    seedMutation,
    rsvpMutation,
    onboardingQuery,
    myInterests,
    displayName,
    hotspots,
    users,
    events,
    seedError,
    didAutoSeed,
  } = useMapData({ center, selectedInterest, radiusKm, distanceUnit });

  const interestArtQuery = useInterestArt();
  const interestArt = useMemo(() => {
    const art = interestArtQuery.data?.art;
    if (!art || typeof art !== "object") {
      return null;
    }
    return art;
  }, [interestArtQuery.data?.art]);

  const {
    sheetRef,
    snapPoints,
    selectedCard,
    setSelectedCard,
    openSheet,
    closeSheet,
    onToggleInterest,
  } = useMapInteractions({ setSelectedInterest });

  const { showDevActions } = useDevMode({
    hotspots,
    users,
    events,
    pointsQuery,
    seedMutation,
    didAutoSeed,
  });

  const greeting = displayName ? `Hey, ${displayName}` : "Hey";

  const {
    filteredHotspots,
    filteredEvents,
    visibleHotspots,
    visibleEvents,
    visiblePeople,
    markerUsers,
    markerEvents,
  } = useMapFilters({
    selectedInterest,
    visibleRegion,
    onlyNow,
    hotspots,
    events,
    users,
    pinFilters,
  });

  const {
    distanceKmBetween,
    applySearchThisArea,
    onPressMyLocation,
    onPressCentralAustin,
  } = useMapActions({
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
  });

  const { shouldShowSearchThisArea } = useSearchThisArea({
    hasMovedMap,
    center,
    visibleRegion,
    distanceKmBetween,
  });

  const { handleHotspotPress, handleUserMarkerPress, handleEventPress } =
    useMapMarkerHandlers({
      mapRef,
      setSelectedInterest,
      setSelectedCard,
      openSheet,
    });

  const handleRsvp = useCallback(
    (eventId, nextJoined) => {
      rsvpMutation.mutate({ eventId, nextJoined });
    },
    [rsvpMutation],
  );

  const { blockMutation, handleUserLongPress } = useBlockUser({
    closeSheet,
    setSelectedCard,
  });

  const openUserProfile = useCallback(
    (u) => {
      const targetUserId = u?.userId || u?.id;
      if (!targetUserId) {
        return;
      }
      router.push(`/user/${targetUserId}`);
    },
    [router],
  );

  const openPlanDetails = useCallback(
    (u) => {
      const planId = u?.id;
      if (!planId) {
        return;
      }
      router.push(`/plans/${planId}`);
    },
    [router],
  );

  const { auth } = useAuth();

  const currentUserId = useMemo(() => {
    const raw = auth?.user?.id;
    const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [auth?.user?.id]);

  const { requestJoinMutation } = useRequestJoin({
    setUpgradePrompt,
  });
  // Join requests from the map are driven by getCtaForPlan (same state machine as lists).

  const { getCtaForPlan } = usePlanCta({
    requestJoinMutation,
  });

  const { messageEventHostMutation, onMessageEventHost } = useMessageEventHost({
    currentUserId,
    setUpgradePrompt,
  });

  const mapProvider = useMapProvider();
  const { errorBanner } = useMapErrors({
    locationStatus,
    pointsQuery,
    onboardingQuery,
    seedError,
  });

  const isWeb = Platform.OS === "web";

  const onRetryMap = useCallback(() => {
    invalidateMany(queryClient, [["mapPoints"], ["onboardingStatus"]]);
  }, [queryClient]);

  useMapEffects({
    mapRef,
    center,
    locationStatus,
    didInitialAutoCenterRef,
    pointsQuery,
    lastUpgradeReasonRef,
    setUpgradePrompt,
    setInterestContext,
    myInterests,
  });

  // If the user came from Nearest and tapped "Open the map", auto-center around
  // their real location (no extra taps needed).
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const wantsUserFocus = focusParam === "user";
    if (!wantsUserFocus) {
      return;
    }

    if (!focusNonce) {
      return;
    }

    if (lastHandledFocusNonceRef.current === focusNonce) {
      return;
    }

    if (!locationStatus?.ready || locationStatus?.error || !userLocation) {
      // Wait until location is ready.
      return;
    }

    const lat = userLocation?.lat;
    const lng = userLocation?.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    lastHandledFocusNonceRef.current = focusNonce;

    setSelectedCard(null);
    closeSheet();
    setOverlayExpanded(false);

    setCenter({ lat, lng });
    setHasMovedMap(false);

    try {
      if (
        mapRef.current &&
        typeof mapRef.current.animateToRegion === "function"
      ) {
        mapRef.current.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
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
    focusParam,
    focusNonce,
    locationStatus?.ready,
    locationStatus?.error,
    userLocation,
    setCenter,
    setHasMovedMap,
    setSelectedCard,
    closeSheet,
    mapRef,
  ]);

  const isMapEmpty = !hotspots.length && !users.length && !events.length;
  const showDemoButton = showDevActions;

  const webIntroText =
    "Map preview isn’t available in the web build. Use iOS/Android for the live map — you can still browse events and plans below.";

  // Web fallback: react-native-maps doesn’t render on web.
  if (isWeb) {
    const eventTitle = onlyNow ? "Events happening now" : "Events";
    const peopleTitle = "People checked in";

    // Keep enough space so the overlay header doesn’t cover the list.
    const topPad = overlayExpanded ? 340 : 220;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={webRefreshControl}
          contentContainerStyle={{
            paddingTop: topPad,
            paddingHorizontal: spacing.base,
            paddingBottom: insets.bottom + 120,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ ...typography.label.md, color: colors.subtext }}>
              {webIntroText}
            </Text>
          </View>

          <View style={{ marginTop: spacing.base }}>
            <Text
              style={{
                ...typography.label.lg,
                color: colors.text,
              }}
            >
              {eventTitle}
            </Text>
            <EventsList
              events={filteredEvents}
              selectedEventId={null}
              onEventPress={() => router.push("/events")}
              onMessageHost={onMessageEventHost}
              currentUserId={currentUserId}
              messageMutation={messageEventHostMutation}
            />
          </View>

          <View style={{ marginTop: spacing.lg }}>
            <Text
              style={{
                ...typography.label.lg,
                color: colors.text,
              }}
            >
              {peopleTitle}
            </Text>
            <UsersList
              users={users}
              selectedUserId={null}
              onUserPress={openPlanDetails}
              onUserLongPress={handleUserLongPress}
              getCtaForPlan={getCtaForPlan}
            />
          </View>
        </ScrollView>

        <MapOverlay
          topInset={insets.top}
          greeting={greeting}
          myInterests={myInterests}
          selectedInterest={selectedInterest}
          onToggleInterest={onToggleInterest}
          errorBanner={errorBanner}
          locationStatus={locationStatus}
          pointsQuery={pointsQuery}
          onPressMyLocation={onPressMyLocation}
          showHotspots={pinFilters.hotspots}
          showEvents={pinFilters.events}
          showPeople={pinFilters.people}
          onlyNow={onlyNow}
          onTogglePins={(key) => {
            setPinFilters((prev) => {
              const next = { ...prev };
              if (key === "events" || key === "people" || key === "hotspots") {
                next[key] = !prev[key];
              }
              return next;
            });
          }}
          onToggleOnlyNow={() => setOnlyNow(!onlyNow)}
          onPressEditInterests={() =>
            router.push("/onboarding?edit=1&startStep=1")
          }
          showSearchThisArea={shouldShowSearchThisArea}
          isSearchingThisArea={pointsQuery.isFetching}
          onPressSearchThisArea={applySearchThisArea}
          launchNotice={locationStatus.notice}
          onPressLaunchHub={onPressCentralAustin}
          onRetry={onRetryMap}
          collapsed={!overlayExpanded}
          onPressExpand={() => setOverlayExpanded(true)}
          onPressCollapse={() => setOverlayExpanded(false)}
          onPressBrowse={null}
          interestArt={interestArt}
        />

        <UpgradePromptModal
          visible={!!upgradePrompt}
          title={upgradePrompt?.title}
          message={upgradePrompt?.message}
          primaryText={upgradePrompt?.primaryCta || "Upgrade"}
          secondaryText={upgradePrompt?.secondaryCta || "Not now"}
          onPrimary={() => {
            const target = upgradePrompt?.target || "/upgrade";
            setUpgradePrompt(null);
            router.push(target);
          }}
          onClose={() => setUpgradePrompt(null)}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={mapProvider}
          style={{ flex: 1 }}
          initialRegion={mapRegion}
          onRegionChangeComplete={(next) => {
            setRegion(next);

            if (!hasSeenInitialRegionRef.current) {
              hasSeenInitialRegionRef.current = true;
              return;
            }
            setHasMovedMap(true);
          }}
          onPress={() => {
            setSelectedCard(null);
            closeSheet();
            setOverlayExpanded(false);
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {locationStatus.ready && !locationStatus.error && userLocation ? (
            <MyLocationMarker
              coordinate={{
                latitude: userLocation.lat,
                longitude: userLocation.lng,
              }}
            />
          ) : null}
          {visibleHotspots ? (
            <HotspotMarkers
              hotspots={filteredHotspots}
              onPress={handleHotspotPress}
              interestArt={interestArt}
            />
          ) : null}
          <EventMarkers
            events={markerEvents}
            onPress={handleEventPress}
            visible={visibleEvents}
            interestArt={interestArt}
          />
          <UserMarkers
            users={markerUsers}
            onPress={handleUserMarkerPress}
            visible={visiblePeople}
          />
        </MapView>

        <MapOverlay
          topInset={insets.top}
          greeting={greeting}
          myInterests={myInterests}
          selectedInterest={selectedInterest}
          onToggleInterest={onToggleInterest}
          errorBanner={errorBanner}
          locationStatus={locationStatus}
          pointsQuery={pointsQuery}
          onPressMyLocation={onPressMyLocation}
          showHotspots={pinFilters.hotspots}
          showEvents={pinFilters.events}
          showPeople={pinFilters.people}
          onlyNow={onlyNow}
          onTogglePins={(key) => {
            setPinFilters((prev) => {
              const next = { ...prev };
              if (key === "events" || key === "people" || key === "hotspots") {
                next[key] = !prev[key];
              }
              return next;
            });
          }}
          onToggleOnlyNow={() => setOnlyNow(!onlyNow)}
          onPressEditInterests={() =>
            router.push("/onboarding?edit=1&startStep=1")
          }
          showSearchThisArea={shouldShowSearchThisArea}
          isSearchingThisArea={pointsQuery.isFetching}
          onPressSearchThisArea={applySearchThisArea}
          launchNotice={locationStatus.notice}
          onPressLaunchHub={onPressCentralAustin}
          onRetry={onRetryMap}
          collapsed={!overlayExpanded}
          onPressExpand={() => setOverlayExpanded(true)}
          onPressCollapse={() => setOverlayExpanded(false)}
          onPressBrowse={() => openSheet(1)}
          interestArt={interestArt}
        />

        {isMapEmpty && !pointsQuery.isLoading ? (
          <EmptyMapNotice showDevActions={showDevActions} />
        ) : null}

        <MapBottomSheet
          sheetRef={sheetRef}
          snapPoints={snapPoints}
          insets={insets}
          selectedInterest={selectedInterest}
          selectedCard={selectedCard}
          events={filteredEvents}
          users={users}
          onlyNow={onlyNow}
          showDevActions={showDevActions}
          seedMutation={seedMutation}
          rsvpMutation={rsvpMutation}
          onEventPress={handleEventPress}
          onUserPress={openPlanDetails}
          onUserLongPress={handleUserLongPress}
          onRsvp={handleRsvp}
          onClose={() => setSelectedCard(null)}
          getCtaForPlan={getCtaForPlan}
          onMessageEventHost={onMessageEventHost}
          currentUserId={currentUserId}
          messageEventMutation={messageEventHostMutation}
        />

        {showDemoButton ? <DemoButton seedMutation={seedMutation} /> : null}

        <UpgradePromptModal
          visible={!!upgradePrompt}
          title={upgradePrompt?.title}
          message={upgradePrompt?.message}
          primaryText={upgradePrompt?.primaryCta || "Upgrade"}
          secondaryText={upgradePrompt?.secondaryCta || "Not now"}
          onPrimary={() => {
            const target = upgradePrompt?.target || "/upgrade";
            setUpgradePrompt(null);
            router.push(target);
          }}
          onClose={() => setUpgradePrompt(null)}
        />
      </View>
    </View>
  );
}
