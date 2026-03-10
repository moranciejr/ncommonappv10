import { Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, MoreHorizontal, Sparkles } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";
import { StaticChip } from "./StaticChip";

const { colors, radius, typography, spacing } = darkTheme;

export function ConversationHeader({
  otherName,
  ncommonTargetId,
  ncommonQuery,
  ncommonCount,
  ncommonChips,
  onBack,
  onMore,
}) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
        borderBottomWidth: 1,
        borderColor: colors.border,
        backgroundColor: "rgba(255,255,255,0.96)",
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.035)",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ChevronLeft size={18} color={colors.text} />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text
          style={{ ...typography.body.lgBold, color: colors.text }}
          numberOfLines={1}
        >
          {otherName}
        </Text>
        <Text
          style={{
            marginTop: 2,
            ...typography.label.sm,
            color: colors.subtext,
          }}
        >
          Be respectful. No solicitation.
        </Text>

        {ncommonTargetId ? (
          <View
            style={{
              marginTop: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              flexWrap: "wrap",
            }}
          >
            <Sparkles size={14} color={colors.purple} />

            {ncommonQuery.isLoading ? (
              <Text
                style={{
                  ...typography.label.sm,
                  color: colors.subtext,
                }}
              >
                Finding nCommon…
              </Text>
            ) : typeof ncommonCount === "number" ? (
              <Text
                style={{
                  ...typography.label.smBold,
                  color: colors.purple,
                }}
              >
                {ncommonCount} in common
              </Text>
            ) : null}

            {!ncommonQuery.isLoading && ncommonChips.length
              ? ncommonChips.map((label) => (
                  <StaticChip key={label} label={label} />
                ))
              : null}
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        onPress={onMore}
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.035)",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <MoreHorizontal size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}
