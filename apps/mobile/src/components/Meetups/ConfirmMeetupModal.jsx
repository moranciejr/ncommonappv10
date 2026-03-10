import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { darkTheme } from "@/utils/theme";
import { useMeetupConfirmation } from "@/hooks/useMeetupConfirmation";

const { colors, typography, radii, spacing } = darkTheme;

function Avatar({ uri, name, size = 48 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceElevated }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.primaryText, fontSize: size * 0.35, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

/**
 * ConfirmMeetupModal
 *
 * Props:
 *   visible      — whether the modal is shown
 *   onClose      — called when dismissed
 *   checkinId    — the plan being confirmed
 *   attendees    — array of { userId, displayName, avatarUrl }
 *   planInterest — e.g. "Coffee"
 *   planLocation — e.g. "Blue Bottle Coffee"
 */
export function ConfirmMeetupModal({
  visible,
  onClose,
  checkinId,
  attendees = [],
  planInterest,
  planLocation,
}) {
  const { confirmMutation } = useMeetupConfirmation({ checkinId });

  // Per-attendee state: null | "yes" | "no"
  const [responses, setResponses] = useState({});
  // Per-attendee "would meet again" toggle (only active if responded "yes")
  const [wouldMeetAgain, setWouldMeetAgain] = useState({});
  // Track which attendees have been submitted
  const [submitted, setSubmitted] = useState({});

  const handleConfirm = useCallback(
    async (attendee) => {
      const met = responses[attendee.userId] === "yes";
      if (!met) {
        // "No" — just mark submitted locally, nothing to POST.
        setSubmitted((s) => ({ ...s, [attendee.userId]: true }));
        return;
      }
      try {
        await confirmMutation.mutateAsync({
          confirmedUserId: attendee.userId,
          wouldMeetAgain: !!wouldMeetAgain[attendee.userId],
        });
        setSubmitted((s) => ({ ...s, [attendee.userId]: true }));
      } catch (err) {
        console.error("confirm meetup failed", err);
      }
    },
    [confirmMutation, responses, wouldMeetAgain],
  );

  const allDone = attendees.length > 0 && attendees.every((a) => submitted[a.userId]);

  const heading = planInterest && planLocation
    ? `${planInterest} at ${planLocation}`
    : planInterest || planLocation || "Your meetup";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
            maxHeight: "85%",
          }}
        >
          {/* Header */}
          <Text
            style={{
              ...typography.heading.lg,
              color: colors.text,
              textAlign: "center",
            }}
          >
            Did you meet up? 👋
          </Text>
          <Text
            style={{
              ...typography.body.md,
              color: colors.subtext,
              textAlign: "center",
              marginTop: 4,
              marginBottom: spacing.md,
            }}
          >
            {heading}
          </Text>

          {allDone ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Text style={{ fontSize: 48 }}>🤝</Text>
              <Text
                style={{
                  ...typography.heading.md,
                  color: colors.text,
                  marginTop: spacing.sm,
                  textAlign: "center",
                }}
              >
                All done!
              </Text>
              <Text
                style={{
                  ...typography.body.md,
                  color: colors.subtext,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Mutual confirmations will appear on your profiles.
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  marginTop: spacing.lg,
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: 12,
                  borderRadius: radii.button,
                }}
              >
                <Text style={{ ...typography.body.mdBold, color: colors.primaryText }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {attendees.map((attendee) => {
                const response = responses[attendee.userId];
                const isDone = submitted[attendee.userId];
                const isPending = confirmMutation.isPending;

                return (
                  <View
                    key={attendee.userId}
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      gap: 12,
                    }}
                  >
                    <Avatar
                      uri={attendee.avatarUrl}
                      name={attendee.displayName}
                      size={48}
                    />

                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={{ ...typography.body.mdBold, color: colors.text }}>
                        {attendee.displayName || "Attendee"}
                      </Text>

                      {isDone ? (
                        <Text style={{ ...typography.body.sm, color: colors.subtext }}>
                          {response === "yes" ? "✓ Confirmed" : "Skipped"}
                        </Text>
                      ) : (
                        <>
                          {/* Yes / No */}
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() =>
                                setResponses((r) => ({ ...r, [attendee.userId]: "yes" }))
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: radii.button,
                                borderWidth: 1.5,
                                borderColor:
                                  response === "yes" ? colors.primary : colors.border,
                                backgroundColor:
                                  response === "yes"
                                    ? colors.primary + "22"
                                    : "transparent",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  ...typography.body.smBold,
                                  color:
                                    response === "yes" ? colors.primary : colors.subtext,
                                }}
                              >
                                Yes, we met
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() =>
                                setResponses((r) => ({ ...r, [attendee.userId]: "no" }))
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: radii.button,
                                borderWidth: 1.5,
                                borderColor:
                                  response === "no" ? colors.subtext : colors.border,
                                backgroundColor:
                                  response === "no"
                                    ? colors.surfaceElevated
                                    : "transparent",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  ...typography.body.smBold,
                                  color: colors.subtext,
                                }}
                              >
                                No
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Would meet again — only shown if "yes" */}
                          {response === "yes" && (
                            <TouchableOpacity
                              onPress={() =>
                                setWouldMeetAgain((w) => ({
                                  ...w,
                                  [attendee.userId]: !w[attendee.userId],
                                }))
                              }
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 4,
                                  borderWidth: 1.5,
                                  borderColor: wouldMeetAgain[attendee.userId]
                                    ? colors.primary
                                    : colors.border,
                                  backgroundColor: wouldMeetAgain[attendee.userId]
                                    ? colors.primary
                                    : "transparent",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {wouldMeetAgain[attendee.userId] && (
                                  <Text style={{ color: colors.primaryText, fontSize: 12 }}>
                                    ✓
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={{ ...typography.body.sm, color: colors.subtext }}
                              >
                                Would meet again
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Confirm button */}
                          {response && (
                            <TouchableOpacity
                              onPress={() => handleConfirm(attendee)}
                              disabled={isPending}
                              style={{
                                backgroundColor: colors.primary,
                                paddingVertical: 8,
                                borderRadius: radii.button,
                                alignItems: "center",
                                opacity: isPending ? 0.6 : 1,
                              }}
                            >
                              {isPending ? (
                                <ActivityIndicator size="small" color={colors.primaryText} />
                              ) : (
                                <Text
                                  style={{
                                    ...typography.body.smBold,
                                    color: colors.primaryText,
                                  }}
                                >
                                  Confirm
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={onClose}
                style={{ alignItems: "center", marginTop: spacing.lg }}
              >
                <Text style={{ ...typography.body.sm, color: colors.subtext }}>
                  Skip for now
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
