import { Text, View } from "react-native";
import { colors } from "@/utils/theme";

export function StaticChip({ label }) {
  return (
    <View
      style={{
        backgroundColor: colors.chipBg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "900", color: colors.chipText }}>
        {label}
      </Text>
    </View>
  );
}
