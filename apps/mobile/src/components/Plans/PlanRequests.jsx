import { Text, TouchableOpacity, View } from "react-native";
import { Check, ShieldCheck, X } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function PlanRequests({
  requests,
  onRespond,
  isResponding,
  highlightRequestId,
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.xl,
        padding: 14,
        ...shadow.card,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          color: colors.text,
          fontSize: 14,
        }}
      >
        Requests
      </Text>

      {Array.isArray(requests) && requests.length ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          {requests.map((r) => {
            const isPending = r.status === "pending";
            const isHighlighted =
              typeof highlightRequestId === "number" &&
              r.id === highlightRequestId;

            const cardBorderColor = isHighlighted
              ? "rgba(47,128,237,0.55)"
              : colors.border;
            const cardBg = isHighlighted
              ? "rgba(47,128,237,0.08)"
              : colors.background;

            return (
              <View
                key={r.id}
                style={{
                  borderWidth: 1,
                  borderColor: cardBorderColor,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: cardBg,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        color: colors.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {r.displayName || "Someone"}
                    </Text>

                    {r?.isVerified ? (
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: "rgba(47,128,237,0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(47,128,237,0.22)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ShieldCheck size={14} color={colors.primary} />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontWeight: "900",
                      color: colors.subtext,
                      fontSize: 12,
                    }}
                  >
                    {r.status}
                  </Text>
                </View>

                {isPending ? (
                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: "row",
                      gap: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        onRespond({
                          requestId: r.id,
                          action: "accept",
                        })
                      }
                      disabled={isResponding}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(16,185,129,0.12)",
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Check size={16} color="#0E9F6E" />
                        <Text
                          style={{
                            fontWeight: "900",
                            color: "#0E9F6E",
                          }}
                        >
                          Accept
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        onRespond({
                          requestId: r.id,
                          action: "decline",
                        })
                      }
                      disabled={isResponding}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(176,0,32,0.12)",
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        paddingVertical: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <X size={16} color={"#FF6B6B"} />
                        <Text
                          style={{
                            fontWeight: "900",
                            color: "#FF6B6B",
                          }}
                        >
                          Decline
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text
          style={{
            marginTop: 8,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          No one has requested yet.
        </Text>
      )}
    </View>
  );
}
