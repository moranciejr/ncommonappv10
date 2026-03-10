import { View, Text } from "react-native";
import { Chip } from "./Chip";
import { colors } from "@/utils/theme";

export function GroupSizeSelector({
  groupSizeOptions,
  desiredGroupSize,
  onSelectGroupSize,
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
        How many people?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {groupSizeOptions.map((n) => (
          <Chip
            key={`gs-${n}`}
            label={n === 5 ? "5+" : String(n)}
            selected={desiredGroupSize === n}
            onPress={() => onSelectGroupSize((cur) => (cur === n ? null : n))}
          />
        ))}
      </View>
    </View>
  );
}
