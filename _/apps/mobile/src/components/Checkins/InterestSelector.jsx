import { View, Text } from "react-native";
import { Chip } from "./Chip";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { colors } from "@/utils/theme";

export function InterestSelector({
  interests,
  selectedInterest,
  onSelectInterest,
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "900",
          color: colors.subtext,
        }}
      >
        Interest
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {interests.length ? (
          interests.map((it) => {
            const label = getInterestLabel(it) || it;
            return (
              <Chip
                key={it}
                label={label}
                selected={selectedInterest === it}
                onPress={() =>
                  onSelectInterest((current) => (current === it ? null : it))
                }
              />
            );
          })
        ) : (
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            Add interests in onboarding first.
          </Text>
        )}
      </View>
    </View>
  );
}
