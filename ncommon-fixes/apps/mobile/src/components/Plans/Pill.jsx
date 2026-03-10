import { Text, View } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function Pill({ text }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.chipBg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: colors.primary }}>
        {text}
      </Text>
    </View>
  );
}
