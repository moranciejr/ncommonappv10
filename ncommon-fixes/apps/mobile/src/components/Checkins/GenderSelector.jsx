import { View, Text } from "react-native";
import { Chip } from "./Chip";
import { darkTheme } from "@/utils/theme";
const { colors } = darkTheme;

export function GenderSelector({ desiredGender, onSelectGender }) {
  return (
    <View style={{ marginTop: 2 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "900",
          color: colors.subtext,
        }}
      >
        Looking for
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        <Chip
          label="Any"
          selected={desiredGender === "any"}
          onPress={() => onSelectGender("any")}
        />
        <Chip
          label="Male"
          selected={desiredGender === "male"}
          onPress={() => onSelectGender("male")}
        />
        <Chip
          label="Female"
          selected={desiredGender === "female"}
          onPress={() => onSelectGender("female")}
        />
      </View>
    </View>
  );
}
