import { View, Text, TouchableOpacity } from "react-native";
import { Users, MapPin } from "lucide-react-native";
import { Chip } from "./Chip";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function LivePlanCard({
  checkin,
  onPress,
  ctaTitle,
  ctaDisabled,
  onCtaPress,
}) {
  const showCta = typeof ctaTitle === "string" && ctaTitle.trim().length > 0;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: radii.xl,
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.92}
        style={{ padding: 14 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "900",
              color: colors.text,
            }}
            numberOfLines={1}
          >
            {checkin.displayName || "Someone"}
          </Text>
          {checkin.isMine ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "900",
                color: colors.primary,
              }}
            >
              You
            </Text>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {checkin.interest ? (
            <Chip
              label={getInterestLabel(checkin.interest) || checkin.interest}
              selected
              onPress={() => {}}
            />
          ) : null}
          {typeof checkin.desiredGroupSize === "number" ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Users size={14} color={colors.subtext} />
              <Text style={{ color: colors.subtext, fontWeight: "800" }}>
                {checkin.desiredGroupSize === 5
                  ? "5+"
                  : checkin.desiredGroupSize}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <MapPin size={14} color={colors.subtext} />
          <Text
            style={{
              color: colors.subtext,
              fontWeight: "800",
              flex: 1,
            }}
            numberOfLines={2}
          >
            {checkin.locationName}
          </Text>
        </View>

        {checkin.note ? (
          <Text
            style={{
              marginTop: 8,
              fontSize: 13,
              color: colors.text,
              lineHeight: 18,
              fontWeight: "700",
            }}
          >
            {checkin.note}
          </Text>
        ) : null}
      </TouchableOpacity>

      {showCta ? (
        <View
          style={{
            padding: 14,
            paddingTop: 0,
          }}
        >
          <TouchableOpacity
            onPress={onCtaPress}
            disabled={!!ctaDisabled}
            style={{
              backgroundColor: ctaDisabled
                ? colors.surfaceElevated
                : colors.primary,
              borderRadius: 16,
              paddingVertical: 12,
              alignItems: "center",
              opacity: ctaDisabled ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: ctaDisabled ? colors.text : colors.primaryText,
                fontWeight: "900",
                fontSize: 14,
              }}
            >
              {ctaTitle}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
