import { Text, TouchableOpacity } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : "rgba(255,255,255,0.92)";
  const color = selected ? colors.primaryText : colors.text;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: 8,
        ...(selected ? shadow.card : {}),
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}
