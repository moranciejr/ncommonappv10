import { Text, View } from "react-native";
import { colors, radii, shadow, spacing, typography } from "@/utils/theme";
import { OptionRow } from "./OptionRow";

export function PlanDefaultsSection({
  settings,
  setDefaultPlanExpiresMinutes,
  setDefaultDesiredGroupSize,
  setDefaultDesiredGender,
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Plan defaults
      </Text>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
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
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Default plan duration
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            New plans will auto-expire after this time.
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {[60, 120, 180, 240].map((m) => {
              const selected = settings.defaultPlanExpiresMinutes === m;
              const label = m === 60 ? "1 hour" : `${Math.round(m / 60)} hours`;
              return (
                <OptionRow
                  key={`dur-${m}`}
                  title={label}
                  subtitle={selected ? "Current" : null}
                  selected={selected}
                  onPress={() => setDefaultPlanExpiresMinutes(m)}
                />
              );
            })}
          </View>
        </View>

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
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Default group size
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Saves time when you post.
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {[null, 1, 2, 3, 4, 5].map((n) => {
              const selected = settings.defaultDesiredGroupSize === n;
              const title = n === null ? "No default" : n === 5 ? "5+" : `${n}`;
              return (
                <OptionRow
                  key={`gs-${String(n)}`}
                  title={title}
                  subtitle={selected ? "Current" : null}
                  selected={selected}
                  onPress={() => setDefaultDesiredGroupSize(n)}
                />
              );
            })}
          </View>
        </View>

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
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Default "looking for"
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Set a default for your plan posts. (This is not a dating feature —
            it just helps set expectations.)
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {[
              { key: "any", title: "Any" },
              { key: "male", title: "Male" },
              { key: "female", title: "Female" },
            ].map((opt) => (
              <OptionRow
                key={`gender-${opt.key}`}
                title={opt.title}
                subtitle={
                  settings.defaultDesiredGender === opt.key ? "Current" : null
                }
                selected={settings.defaultDesiredGender === opt.key}
                onPress={() => setDefaultDesiredGender(opt.key)}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
