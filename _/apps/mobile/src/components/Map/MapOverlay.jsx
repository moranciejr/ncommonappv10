import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image as RNImage,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpen,
  Gamepad2,
  MapPin,
  Mountain,
  Music,
  Pencil,
  Plus,
  Trophy,
  Utensils,
  LocateFixed,
  ChevronUp,
  SlidersHorizontal,
  List,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { Chip } from "./Chip";
import {
  getInterestLabel,
  getInterestCategory,
  getInterestCategoryIdForValue,
} from "@/utils/interestTaxonomy";
import { colors, shadow } from "@/utils/theme";
import { useSubscription } from "@/hooks/useSubscription";

export function MapOverlay({
  topInset = 0,
  greeting,
  myInterests,
  selectedInterest,
  onToggleInterest,
  errorBanner,
  locationStatus,
  pointsQuery,
  onPressMyLocation,
  showHotspots = true,
  showEvents = true,
  showPeople = true,
  onlyNow = false,
  onTogglePins,
  onToggleOnlyNow,
  onPressEditInterests,
  // NEW: in-header "Search this area" so it doesn't overlap chips/tabs
  showSearchThisArea = false,
  isSearchingThisArea = false,
  onPressSearchThisArea,
  // NEW: soft launch notice (Austin core)
  launchNotice,
  onPressLaunchHub,
  // NEW: let the parent decide how to refresh map-related queries (invalidate multiple keys)
  onRetry,
  // NEW: allow the parent to collapse this overlay so the map is easier to see
  collapsed = false,
  onPressExpand,
  onPressCollapse,
  onPressBrowse,
  // NEW: interest art so the legend can show the same images as the pins
  interestArt = null,
}) {
  const router = useRouter();
  const { tier } = useSubscription();
  const showUpgrade = tier === "free";

  // NEW: build a tiny legend from *your interests* so users know what the pin images mean.
  // (Shown only when expanded, so it doesn't clutter the map.)
  const legendItems = (() => {
    const out = [];
    const seen = new Set();

    for (const it of myInterests || []) {
      const id = getInterestCategoryIdForValue(it);
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);

      const category = getInterestCategory(it) || "Other";
      out.push({ id, label: category });
    }

    return out;
  })();

  const iconForLegendId = (id) => {
    if (id === "food") return Utensils;
    if (id === "music") return Music;
    if (id === "games") return Gamepad2;
    if (id === "outdoors") return Mountain;
    if (id === "sports") return Trophy;
    return BookOpen;
  };

  // Allow retry on network errors / transient backend hiccups.
  const canRetry =
    typeof onRetry === "function" ||
    (!!pointsQuery?.error && typeof pointsQuery?.refetch === "function");

  const handleEditInterests = () => {
    if (typeof onPressEditInterests === "function") {
      onPressEditInterests();
      return;
    }
    router.push("/onboarding?edit=1&startStep=1");
  };

  const shouldShowLaunchNotice =
    typeof launchNotice === "string" && !!launchNotice.trim();

  const launchHubName =
    typeof locationStatus?.launchHubName === "string" &&
    locationStatus.launchHubName.trim()
      ? locationStatus.launchHubName.trim()
      : "Central Austin";

  // NEW: show which hub we think is best "right now" (time-based heuristic in useMapLocation)
  const recommendedHubId =
    typeof locationStatus?.recommendedHubId === "string"
      ? locationStatus.recommendedHubId
      : "";

  const recommendedHubName =
    typeof locationStatus?.recommendedHubName === "string" &&
    locationStatus.recommendedHubName.trim()
      ? locationStatus.recommendedHubName.trim()
      : null;

  const recommendedHubReason =
    typeof locationStatus?.recommendedHubReason === "string" &&
    locationStatus.recommendedHubReason.trim()
      ? locationStatus.recommendedHubReason.trim()
      : null;

  const handlePressLaunchHub = () => {
    if (typeof onPressLaunchHub !== "function") {
      return;
    }

    const hubs = [
      { id: "downtown", name: "Downtown" },
      { id: "ut", name: "UT" },
      { id: "soco", name: "South Congress" },
    ];

    const sorted = [...hubs].sort((a, b) => {
      const aScore = a.id === recommendedHubId ? 0 : 1;
      const bScore = b.id === recommendedHubId ? 0 : 1;
      return aScore - bScore;
    });

    const buttons = sorted.map((hub) => {
      const isRecommended = hub.id === recommendedHubId;
      const label = isRecommended ? `${hub.name} (recommended)` : hub.name;
      return {
        text: label,
        onPress: () => onPressLaunchHub(hub.id),
      };
    });

    buttons.push({ text: "Cancel", style: "cancel" });

    const why = recommendedHubReason ? ` (${recommendedHubReason})` : "";

    const subtitle = recommendedHubName
      ? `Pick an area. Recommended right now: ${recommendedHubName}${why}.`
      : "Pick an area";

    Alert.alert("Central Austin", subtitle, buttons);
  };

  const showMinimize = !collapsed && typeof onPressCollapse === "function";
  const showExpand = collapsed && typeof onPressExpand === "function";
  const showBrowse = typeof onPressBrowse === "function";

  const overlayPaddingBottom = collapsed ? 10 : 14;

  const titleTextStyle = collapsed
    ? {
        fontSize: 18,
        fontWeight: "900",
        color: colors.text,
        flex: 1,
        paddingRight: 8,
      }
    : {
        fontSize: 22,
        fontWeight: "900",
        color: colors.text,
        flex: 1,
        paddingRight: 8,
      };

  const renderCollapsedActions = collapsed;

  return (
    <LinearGradient
      colors={
        collapsed
          ? [
              "rgba(246,247,251,0.96)",
              "rgba(246,247,251,0.55)",
              "rgba(246,247,251,0.00)",
            ]
          : [
              "rgba(246,247,251,0.98)",
              "rgba(246,247,251,0.70)",
              "rgba(246,247,251,0.00)",
            ]
      }
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: Math.max(6, topInset + 6),
        paddingHorizontal: 16,
        paddingBottom: overlayPaddingBottom,
      }}
      pointerEvents="box-none"
    >
      {/* Header */}
      <View style={{ gap: collapsed ? 6 : 8 }}>
        {/* Top row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text numberOfLines={1} ellipsizeMode="tail" style={titleTextStyle}>
            {greeting}
          </Text>

          {renderCollapsedActions ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {showBrowse ? (
                <TouchableOpacity
                  onPress={onPressBrowse}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                    flexShrink: 0,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Browse around you"
                >
                  <List size={18} color={colors.primary} />
                </TouchableOpacity>
              ) : null}

              {showExpand ? (
                <TouchableOpacity
                  onPress={onPressExpand}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                    flexShrink: 0,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Show map controls"
                >
                  <SlidersHorizontal size={18} color={colors.text} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => router.push("/checkins")}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                  flexShrink: 0,
                }}
                accessibilityRole="button"
                accessibilityLabel="Post a plan"
              >
                <MapPin size={18} color={colors.primaryText} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onPressMyLocation}
                disabled={!onPressMyLocation}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                  flexShrink: 0,
                }}
              >
                <LocateFixed size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {showMinimize ? (
                <TouchableOpacity
                  onPress={onPressCollapse}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                    flexShrink: 0,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Hide map controls"
                >
                  <ChevronUp size={18} color={colors.text} />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={onPressMyLocation}
                disabled={!onPressMyLocation}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                  flexShrink: 0,
                }}
              >
                <LocateFixed size={18} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {collapsed ? (
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flex: 1 }}
              showsHorizontalScrollIndicator={false}
            >
              {myInterests.length
                ? myInterests.map((it) => {
                    const label = getInterestLabel(it) || it;
                    return (
                      <Chip
                        key={it}
                        label={label}
                        selected={selectedInterest === it}
                        onPress={() => onToggleInterest(it)}
                      />
                    );
                  })
                : null}
            </ScrollView>

            <TouchableOpacity
              onPress={handleEditInterests}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                ...shadow.card,
                flexShrink: 0,
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit interests"
            >
              <Pencil size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* In collapsed mode, keep the map clean: hide everything else */}
        {collapsed ? null : (
          <>
            {/* Second row: subtitle (full width) */}
            <Text
              style={{
                marginTop: 0,
                fontSize: 13,
                color: colors.subtext,
                fontWeight: "700",
              }}
            >
              Plans & events
            </Text>

            {/* NEW: Austin soft-launch notice */}
            {shouldShowLaunchNotice ? (
              <View
                style={{
                  marginTop: 4,
                  backgroundColor: colors.surfaceTint,
                  borderWidth: 1,
                  borderColor: "rgba(45,17,77,0.18)",
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  ...shadow.card,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {launchNotice}
                </Text>

                <View
                  style={{
                    marginTop: 10,
                    flexDirection: "row",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <TouchableOpacity
                    onPress={handlePressLaunchHub}
                    disabled={!onPressLaunchHub}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 999,
                      backgroundColor: "rgba(255,255,255,0.92)",
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {`Central Austin · ${launchHubName}`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onPressMyLocation}
                    disabled={!onPressMyLocation}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 999,
                      backgroundColor: colors.primary,
                      borderWidth: 1,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text
                      style={{ color: colors.primaryText, fontWeight: "900" }}
                    >
                      Use my area
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Third row: actions (can wrap without breaking the title) */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {showUpgrade ? (
                <TouchableOpacity
                  onPress={() => router.push("/upgrade")}
                  style={{
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.92)",
                    borderWidth: 1,
                    borderColor: "rgba(45,17,77,0.22)",
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    Upgrade
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={() => router.push("/events")}
                style={{
                  paddingHorizontal: 12,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                  ...shadow.card,
                }}
              >
                <Plus size={16} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  Event
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/checkins")}
                style={{
                  paddingHorizontal: 12,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                  ...shadow.card,
                }}
              >
                <MapPin size={16} color={colors.primaryText} />
                <Text
                  style={{
                    color: colors.primaryText,
                    fontWeight: "900",
                    fontSize: 12,
                  }}
                >
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interests row (with an always-visible edit button) */}
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ScrollView
                horizontal
                style={{ flexGrow: 0, flex: 1 }}
                showsHorizontalScrollIndicator={false}
              >
                {myInterests.length ? (
                  myInterests.map((it) => {
                    const label = getInterestLabel(it) || it;
                    return (
                      <Chip
                        key={it}
                        label={label}
                        selected={selectedInterest === it}
                        onPress={() => onToggleInterest(it)}
                      />
                    );
                  })
                ) : (
                  <TouchableOpacity
                    onPress={handleEditInterests}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.92)",
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      ...shadow.card,
                    }}
                  >
                    <Pencil size={16} color={colors.primary} />
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      Add interests
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={handleEditInterests}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadow.card,
                  flexShrink: 0,
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit interests"
              >
                <Pencil size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Pin filters (quick toggles without leaving the map) */}
            <View style={{ marginTop: 10 }}>
              <ScrollView
                horizontal
                style={{ flexGrow: 0 }}
                showsHorizontalScrollIndicator={false}
              >
                <Chip
                  label="Events"
                  selected={!!showEvents}
                  onPress={() => onTogglePins?.("events")}
                />
                <Chip
                  label="People"
                  selected={!!showPeople}
                  onPress={() => onTogglePins?.("people")}
                />
                <Chip
                  label="Hotspots"
                  selected={!!showHotspots && !onlyNow}
                  onPress={() => onTogglePins?.("hotspots")}
                />
                <Chip
                  label={onlyNow ? "Only Now" : "All times"}
                  selected={!!onlyNow}
                  onPress={() => onToggleOnlyNow?.()}
                />
              </ScrollView>

              {onlyNow ? (
                <Text
                  style={{
                    marginTop: 6,
                    color: colors.subtext,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Showing active check-ins + events happening right now.
                </Text>
              ) : null}

              {/* NEW: legend for pin images (only when expanded) */}
              {(showEvents || showHotspots) && legendItems.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={{
                      color: colors.subtext,
                      fontSize: 12,
                      fontWeight: "800",
                      marginBottom: 8,
                    }}
                  >
                    Pin images
                  </Text>

                  <ScrollView
                    horizontal
                    style={{ flexGrow: 0 }}
                    showsHorizontalScrollIndicator={false}
                  >
                    {legendItems.map((it) => {
                      const url = interestArt?.[it.id] || interestArt?.other;
                      const hasUrl = typeof url === "string" && !!url;
                      const Icon = iconForLegendId(it.id);

                      return (
                        <View
                          key={it.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 999,
                            marginRight: 10,
                            backgroundColor: "rgba(255,255,255,0.92)",
                            borderWidth: 1,
                            borderColor: colors.border,
                            ...shadow.card,
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              overflow: "hidden",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "#fff",
                              borderWidth: 1,
                              borderColor: "rgba(0,0,0,0.08)",
                            }}
                          >
                            {hasUrl ? (
                              <RNImage
                                source={{ uri: url }}
                                style={{ width: "92%", height: "92%" }}
                                resizeMode="contain"
                              />
                            ) : (
                              <Icon size={12} color={colors.primary} />
                            )}
                          </View>

                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.text,
                              fontWeight: "900",
                              fontSize: 12,
                              maxWidth: 170,
                            }}
                          >
                            {it.label}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      {/* Keep “Search this area” available even when collapsed (it’s core map UX) */}
      {showSearchThisArea ? (
        <View
          style={{
            marginTop: collapsed ? 8 : 10,
            alignItems: "center",
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={onPressSearchThisArea}
            disabled={!onPressSearchThisArea || isSearchingThisArea}
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
              opacity: isSearchingThisArea ? 0.7 : 1,
              ...shadow.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {isSearchingThisArea ? "Updating…" : "Search this area"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Errors stay visible even when collapsed, but compact */}
      {errorBanner ? (
        <View
          style={{
            marginTop: 10,
            backgroundColor: "rgba(253, 236, 236, 0.96)",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
            {errorBanner}
          </Text>

          {canRetry ? (
            <TouchableOpacity
              onPress={() => {
                if (typeof onRetry === "function") {
                  onRetry();
                  return;
                }
                if (pointsQuery && typeof pointsQuery.refetch === "function") {
                  pointsQuery.refetch();
                }
              }}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                ...shadow.card,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                Retry
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {locationStatus.ready && pointsQuery.isLoading ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </LinearGradient>
  );
}
