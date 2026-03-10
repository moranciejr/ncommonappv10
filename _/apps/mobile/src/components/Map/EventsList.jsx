import { Text, TouchableOpacity, View } from "react-native";
import { colorForInterest, formatWhenShort } from "@/utils/formatUtils";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { colors, radii, shadow } from "@/utils/theme";

export function EventsList({
  events,
  selectedEventId,
  onEventPress,
  onMessageHost,
  currentUserId,
  messageMutation,
}) {
  const hasEvents = events.length > 0;

  if (!hasEvents) {
    return (
      <View
        style={{
          marginTop: 10,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.card,
          padding: 14,
          ...shadow.card,
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          No events yet
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          Create one in Events — it’ll show up here right away.
        </Text>
      </View>
    );
  }

  const happeningNow = events.filter((e) => !!e.isHappeningNow);
  const upcoming = events.filter((e) => !e.isHappeningNow);

  const renderSection = (title, list) => {
    if (!list.length) {
      return null;
    }

    return (
      <View style={{ marginTop: 10 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "900",
            color: colors.subtext,
            marginBottom: 8,
          }}
        >
          {title}
        </Text>

        <View style={{ gap: 10 }}>
          {list.slice(0, 12).map((e) => {
            const isSelected = selectedEventId === e.id;
            const interestLabel = getInterestLabel(e.interest) || e.interest;

            const badgeText = e.isHappeningNow
              ? "Happening now"
              : formatWhenShort(e.startsAt);

            const badgeBg = e.isHappeningNow ? colors.accent : colors.mutedBg;
            const badgeColor = e.isHappeningNow ? "#FFFFFF" : colors.text;

            const attendeeCount =
              typeof e.attendeeCount === "number" ? e.attendeeCount : 0;

            const accent = colorForInterest(e.interest);

            const cardBorder = isSelected
              ? "rgba(45,17,77,0.22)"
              : colors.border;

            const isMine =
              typeof currentUserId === "number" &&
              typeof e.creatorUserId === "number" &&
              e.creatorUserId === currentUserId;

            const messageTitle = isMine ? "Your event" : "Message host";
            const messageDisabled =
              isMine || !!messageMutation?.isPending || !e.creatorUserId;

            return (
              <TouchableOpacity
                key={`sheet-event-${e.id}`}
                onPress={() => onEventPress(e)}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  borderRadius: 18,
                  padding: 14,
                  ...shadow.card,
                }}
              >
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View
                    style={{
                      width: 10,
                      borderRadius: 999,
                      backgroundColor: accent,
                      opacity: 0.9,
                    }}
                  />

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "900",
                            color: colors.text,
                          }}
                          numberOfLines={1}
                        >
                          {e.title || "Event"}
                        </Text>
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: colors.subtext,
                            fontWeight: "800",
                          }}
                          numberOfLines={1}
                        >
                          {interestLabel}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={{
                            backgroundColor: badgeBg,
                            paddingHorizontal: 10,
                            paddingVertical: 7,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "900",
                              color: badgeColor,
                            }}
                          >
                            {badgeText}
                          </Text>
                        </View>
                        <Text
                          style={{
                            marginTop: 8,
                            fontSize: 11,
                            color: colors.subtext,
                            fontWeight: "800",
                          }}
                        >
                          {attendeeCount} going
                        </Text>
                      </View>
                    </View>

                    {e.locationName ? (
                      <Text
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: colors.subtext,
                          fontWeight: "700",
                        }}
                        numberOfLines={1}
                      >
                        {e.locationName}
                      </Text>
                    ) : null}

                    <View
                      style={{
                        marginTop: 12,
                        flexDirection: "row",
                        justifyContent: "flex-end",
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => onMessageHost?.(e)}
                        disabled={messageDisabled}
                        style={{
                          backgroundColor: colors.primary,
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          opacity: messageDisabled ? 0.6 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryText,
                            fontWeight: "900",
                          }}
                        >
                          {messageTitle}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={{ marginTop: 6 }}>
      {renderSection("Happening now", happeningNow)}
      {renderSection("Upcoming", upcoming)}
    </View>
  );
}
