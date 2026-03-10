import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Lock } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function PlanInsights({
  insightsQuery,
  onPressInsightsUpgrade,
  onViewerPress,
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
      <Text style={{ fontWeight: "900", color: colors.text }}>
        Plan activity
      </Text>

      {insightsQuery.isLoading ? (
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : insightsQuery.error ? (
        <Text
          style={{
            marginTop: 8,
            color: colors.subtext,
            fontWeight: "700",
          }}
        >
          Could not load insights.
        </Text>
      ) : (
        <View style={{ marginTop: 10, gap: 10 }}>
          <Text style={{ color: colors.subtext, fontWeight: "800" }}>
            Views (last 24h): {insightsQuery.data?.usage?.viewsLast24h || 0}
          </Text>

          {insightsQuery.data?.locked ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                backgroundColor: colors.background,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Lock size={16} color={colors.subtext} />
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontWeight: "900",
                  }}
                >
                  Viewer list + view alerts
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 6,
                  color: colors.subtext,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
              >
                Upgrade to Plus to see exactly who viewed your plan and to get
                notified when it happens.
              </Text>

              <TouchableOpacity
                onPress={onPressInsightsUpgrade}
                style={{
                  marginTop: 12,
                  backgroundColor: colors.primary,
                  borderRadius: radii.lg,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.primaryText,
                    fontWeight: "900",
                  }}
                >
                  Upgrade
                </Text>
              </TouchableOpacity>
            </View>
          ) : Array.isArray(insightsQuery.data?.viewers) &&
            insightsQuery.data.viewers.length ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: colors.surfaceElevated,
                }}
              >
                {(() => {
                  const enabled =
                    insightsQuery.data?.usage?.viewAlertsEnabled === true;
                  const title = enabled
                    ? "View alerts: On"
                    : "View alerts: Off";
                  const subtitle = enabled
                    ? "You'll get a notification when someone views your plan."
                    : "You won't be notified when someone views your plan.";

                  return (
                    <>
                      <Text
                        style={{
                          fontWeight: "900",
                          color: colors.text,
                        }}
                      >
                        {title}
                      </Text>
                      <Text
                        style={{
                          marginTop: 4,
                          color: colors.subtext,
                          fontWeight: "700",
                        }}
                      >
                        {subtitle}
                      </Text>
                    </>
                  );
                })()}
              </View>

              {insightsQuery.data.viewers.slice(0, 8).map((v) => (
                <TouchableOpacity
                  key={`viewer-${v.userId}`}
                  onPress={() => onViewerPress(v.userId)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 12,
                    backgroundColor: colors.background,
                  }}
                >
                  <Text
                    style={{ fontWeight: "900", color: colors.text }}
                    numberOfLines={1}
                  >
                    {v.displayName || "Someone"}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      color: colors.subtext,
                      fontWeight: "700",
                    }}
                  >
                    Viewed recently
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text
              style={{
                color: colors.subtext,
                fontWeight: "700",
              }}
            >
              No views yet.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
