import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { colors, radii, shadow, spacing, typography } from "@/utils/theme";
import { OptionRow } from "./OptionRow";

export function DistanceUnitsSection({ unit, isLoading, isSaving, setUnit }) {
  const unitLabel = useMemo(() => {
    return unit === "km" ? "Kilometers" : "Miles";
  }, [unit]);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.card,
        padding: spacing.md,
        ...shadow.card,
      }}
    >
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Distance units
      </Text>
      <Text
        style={{
          marginTop: spacing.xs,
          ...typography.body.smBold,
          color: colors.subtext,
          lineHeight: 18,
        }}
      >
        Choose how distances are shown across the app. Current: {unitLabel}
      </Text>

      {isLoading ? (
        <View style={{ marginTop: spacing.md, alignItems: "center" }}>
          <ActivityIndicator color={colors.yellow} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <OptionRow
            title="Miles"
            subtitle="Best if you're in the US"
            selected={unit !== "km"}
            onPress={() => setUnit("mi")}
          />
          <OptionRow
            title="Kilometers"
            subtitle="Common outside the US"
            selected={unit === "km"}
            onPress={() => setUnit("km")}
          />

          {isSaving ? (
            <View style={{ marginTop: spacing.sm, alignItems: "center" }}>
              <ActivityIndicator color={colors.yellow} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
