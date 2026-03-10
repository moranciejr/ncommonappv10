import { useMemo } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { X, MessageCircle, ArrowRight, Sparkles } from "lucide-react-native";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { useNCommonWithUser } from "@/hooks/useNCommonWithUser";
import { EventsList } from "./EventsList";
import { UsersList } from "./UsersList";
import { colors, shadow } from "@/utils/theme";

function StaticChip({ label }) {
  return (
    <View
      style={{
        backgroundColor: colors.mutedBg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "900", color: colors.text }}>
        {label}
      </Text>
    </View>
  );
}

function formatDesiredGroupSize(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    return null;
  }
  if (n === 1) {
    return "1 person";
  }
  return `${n} people`;
}

export function MapBottomSheet({
  sheetRef,
  snapPoints,
  insets,
  selectedInterest,
  selectedCard,
  events,
  users,
  onlyNow = false,
  showDevActions,
  seedMutation,
  rsvpMutation,
  onEventPress,
  onUserPress,
  onUserLongPress,
  onRsvp,
  onClose,
  getCtaForPlan,
  onMessageEventHost,
  currentUserId,
  messageEventMutation,
  // NEW: let the sheet reflect “in flight” join requests
  // isRequestingJoin = false,
}) {
  const sheetTitle = selectedInterest
    ? getInterestLabel(selectedInterest) || selectedInterest
    : "Around you";

  const eventListTitle = onlyNow
    ? "Events happening now"
    : selectedInterest
      ? "Events"
      : "Events (next 2 weeks)";

  const selectedEventId =
    selectedCard?.type === "event" ? selectedCard?.data?.id : null;

  const selectedUserId =
    selectedCard?.type === "user" ? selectedCard?.data?.id : null;

  // IMPORTANT: prefer the canonical plan object from the latest `users` list
  // so optimistic updates (request join) reflect immediately in the selected preview.
  const selectedUserFromList = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }
    const list = Array.isArray(users) ? users : [];
    return list.find((u) => u?.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  const selectedLocationName =
    selectedCard?.type === "hotspot"
      ? selectedCard?.data?.locationName || ""
      : "";

  const selectedUser = selectedUserFromList
    ? selectedUserFromList
    : selectedCard?.type === "user"
      ? selectedCard?.data
      : null;
  const selectedEvent =
    selectedCard?.type === "event" ? selectedCard?.data : null;

  const selectedUserCta = useMemo(() => {
    if (!selectedUser || typeof getCtaForPlan !== "function") {
      return null;
    }
    return getCtaForPlan(selectedUser);
  }, [getCtaForPlan, selectedUser]);

  const selectedUserCtaTitle =
    typeof selectedUserCta?.title === "string" ? selectedUserCta.title : null;
  const selectedUserCtaDisabled = !!selectedUserCta?.disabled;
  const onPressSelectedUserCta =
    typeof selectedUserCta?.onPress === "function"
      ? selectedUserCta.onPress
      : null;

  const selectedInterestLabel = useMemo(() => {
    const raw = selectedUser?.interest || selectedEvent?.interest || null;
    if (!raw) {
      return null;
    }
    return getInterestLabel(raw) || raw;
  }, [selectedEvent?.interest, selectedUser?.interest]);

  const selectedGroupSizeText = useMemo(() => {
    return formatDesiredGroupSize(selectedUser?.desiredGroupSize);
  }, [selectedUser?.desiredGroupSize]);

  const selectedNCommonTargetUserId =
    selectedUser && !selectedUser.isMine ? selectedUser.userId : null;

  const ncommonQuery = useNCommonWithUser(selectedNCommonTargetUserId);

  const ncommonCount = useMemo(() => {
    const n = ncommonQuery.data?.overlapCount;
    return typeof n === "number" ? n : null;
  }, [ncommonQuery.data?.overlapCount]);

  const ncommonChips = useMemo(() => {
    const list = ncommonQuery.data?.overlapInterests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .map((i) => getInterestLabel(i) || i)
      .filter(Boolean)
      .slice(0, 3);
  }, [ncommonQuery.data?.overlapInterests]);

  const eventCount = Array.isArray(events) ? events.length : 0;
  const userCount = Array.isArray(users) ? users.length : 0;

  const subtitleReminder = selectedLocationName
    ? `Near ${selectedLocationName}`
    : "Events first — then people doing the same thing.";

  const closeSheet = () => {
    try {
      if (sheetRef?.current && typeof sheetRef.current.close === "function") {
        sheetRef.current.close();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{
        backgroundColor: "rgba(255,255,255,0.98)",
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      }}
      handleIndicatorStyle={{ backgroundColor: "rgba(0,0,0,0.18)" }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 20, fontWeight: "900", color: colors.text }}
            >
              {sheetTitle}
            </Text>

            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: "800",
                color: colors.subtext,
              }}
            >
              {subtitleReminder}
            </Text>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <View
                style={{
                  backgroundColor: colors.chipBg,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: colors.chipText,
                  }}
                >
                  {eventCount} events
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: colors.mutedBg,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: colors.text,
                  }}
                >
                  {userCount} check-ins
                </Text>
              </View>

              {showDevActions ? (
                <TouchableOpacity
                  onPress={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 999,
                    opacity: seedMutation.isPending ? 0.7 : 1,
                    ...shadow.card,
                  }}
                >
                  <Text
                    style={{
                      color: colors.primaryText,
                      fontWeight: "900",
                      fontSize: 12,
                    }}
                  >
                    {seedMutation.isPending ? "Seeding…" : "Demo"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: "rgba(16,24,40,0.05)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <X size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Selected pin preview (more info + clear next step) */}
        {selectedUser ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: "rgba(45,17,77,0.18)",
              borderRadius: 20,
              padding: 14,
              ...shadow.card,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}
            >
              Selected plan
            </Text>

            <Text
              style={{
                marginTop: 6,
                fontSize: 16,
                fontWeight: "900",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {selectedUser.displayName || "Someone"}
            </Text>

            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: "800",
                color: colors.subtext,
              }}
              numberOfLines={2}
            >
              {[
                selectedInterestLabel,
                selectedGroupSizeText ? `wants ${selectedGroupSizeText}` : null,
                selectedUser.locationName,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>

            {/* NEW: nCommon preview */}
            {!selectedUser.isMine ? (
              <View style={{ marginTop: 10 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Sparkles size={16} color={colors.primary} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "900",
                      color: colors.text,
                    }}
                  >
                    {ncommonQuery.isLoading ? "Finding nCommon…" : "nCommon"}
                  </Text>

                  {ncommonQuery.isLoading ? (
                    <ActivityIndicator size="small" />
                  ) : typeof ncommonCount === "number" ? (
                    <View
                      style={{
                        marginLeft: "auto",
                        backgroundColor: colors.chipBg,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "900",
                          color: colors.primary,
                        }}
                      >
                        {ncommonCount} in common
                      </Text>
                    </View>
                  ) : null}
                </View>

                {!ncommonQuery.isLoading && ncommonChips.length ? (
                  <View
                    style={{
                      marginTop: 8,
                      flexDirection: "row",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {ncommonChips.map((label) => (
                      <StaticChip key={label} label={label} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {selectedUser.note ? (
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.text,
                  lineHeight: 18,
                }}
                numberOfLines={4}
              >
                {selectedUser.note}
              </Text>
            ) : null}

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <TouchableOpacity
                onPress={() => onUserPress?.(selectedUser)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceTint,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  View details
                </Text>
              </TouchableOpacity>

              {selectedUserCtaTitle ? (
                <TouchableOpacity
                  onPress={onPressSelectedUserCta}
                  disabled={selectedUserCtaDisabled || !onPressSelectedUserCta}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: selectedUserCtaDisabled
                      ? colors.surfaceTint
                      : colors.primary,
                    borderWidth: 1,
                    borderColor: selectedUserCtaDisabled
                      ? colors.border
                      : colors.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: selectedUserCtaDisabled ? 0.7 : 1,
                  }}
                >
                  <MessageCircle
                    size={16}
                    color={
                      selectedUserCtaDisabled ? colors.text : colors.primaryText
                    }
                  />
                  <Text
                    style={{
                      color: selectedUserCtaDisabled
                        ? colors.text
                        : colors.primaryText,
                      fontWeight: "900",
                    }}
                  >
                    {selectedUserCtaTitle}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {selectedEvent ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: "rgba(45,17,77,0.14)",
              borderRadius: 20,
              padding: 14,
              ...shadow.card,
            }}
          >
            <Text
              style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}
            >
              Selected event
            </Text>

            <Text
              style={{
                marginTop: 6,
                fontSize: 16,
                fontWeight: "900",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {selectedEvent.title || "Event"}
            </Text>

            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                fontWeight: "800",
                color: colors.subtext,
              }}
              numberOfLines={2}
            >
              {[selectedInterestLabel, selectedEvent.locationName]
                .filter(Boolean)
                .join(" · ")}
            </Text>

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {typeof currentUserId === "number" &&
              typeof selectedEvent?.creatorUserId === "number" &&
              selectedEvent.creatorUserId === currentUserId ? null : (
                <TouchableOpacity
                  onPress={() => onMessageEventHost?.(selectedEvent)}
                  disabled={!!messageEventMutation?.isPending}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    opacity: messageEventMutation?.isPending ? 0.7 : 1,
                  }}
                >
                  <MessageCircle size={16} color={colors.primaryText} />
                  <Text
                    style={{ color: colors.primaryText, fontWeight: "900" }}
                  >
                    Message host
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => onEventPress?.(selectedEvent)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: colors.surfaceTint,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  See on map
                </Text>
                <ArrowRight size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Events first */}
        <View style={{ marginTop: 16 }}>
          <Text
            style={{ fontSize: 13, fontWeight: "900", color: colors.primary }}
          >
            {eventListTitle}
          </Text>

          <EventsList
            events={events}
            selectedEventId={selectedEventId}
            onEventPress={onEventPress}
            onMessageHost={onMessageEventHost}
            currentUserId={currentUserId}
            messageMutation={messageEventMutation}
          />
        </View>

        {/* People second */}
        <View style={{ marginTop: 18 }}>
          <Text
            style={{ fontSize: 13, fontWeight: "900", color: colors.primary }}
          >
            People checked in
          </Text>

          <UsersList
            users={users}
            selectedUserId={selectedUserId}
            onUserPress={onUserPress}
            onUserLongPress={onUserLongPress}
            getCtaForPlan={getCtaForPlan}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
