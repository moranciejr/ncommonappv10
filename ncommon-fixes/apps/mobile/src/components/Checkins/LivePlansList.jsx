import { View, Text, ActivityIndicator } from "react-native";
import { LivePlanCard } from "./LivePlanCard";
import ErrorNotice from "@/components/ErrorNotice";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { shouldShowDevUi } from "@/utils/env";

export function LivePlansList({
  checkins,
  isLoading,
  error,
  onRetry,
  onPlanPress,
  getCtaForPlan,
}) {
  const showDevUi = shouldShowDevUi();

  return (
    <>
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
          Live plans
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontSize: 12,
            color: colors.subtext,
            fontWeight: "700",
          }}
        >
          Tap a plan to view details, or use the button to act fast.
        </Text>
      </View>

      <ErrorNotice
        message={error}
        onRetry={onRetry}
        style={error ? { marginTop: 12 } : null}
      />

      {!isLoading ? (
        <View style={{ marginTop: 12, gap: 12 }}>
          {checkins.length ? (
            checkins.map((c) => {
              const cta = getCtaForPlan ? getCtaForPlan(c) : null;
              const ctaTitle = cta?.title || null;
              const ctaDisabled = !!cta?.disabled;
              const onCtaPress =
                typeof cta?.onPress === "function" ? cta.onPress : null;

              return (
                <LivePlanCard
                  key={c.id}
                  checkin={c}
                  onPress={() => onPlanPress(c)}
                  ctaTitle={ctaTitle}
                  ctaDisabled={ctaDisabled}
                  onCtaPress={onCtaPress}
                />
              );
            })
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: radii.xl,
                padding: 14,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.text,
                }}
              >
                No plans yet
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: colors.subtext,
                  lineHeight: 18,
                  fontWeight: "700",
                }}
              >
                {showDevUi
                  ? "Post the first one — or go to Map → Demo."
                  : "Post the first one — you'll show up on the map right away."}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <ActivityIndicator />
        </View>
      )}
    </>
  );
}
