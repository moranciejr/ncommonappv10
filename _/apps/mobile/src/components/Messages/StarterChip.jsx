import { Text, TouchableOpacity } from "react-native";
import { colors } from "@/utils/theme";

export function StarterChip({ label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.chipBg,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color: colors.chipText }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
