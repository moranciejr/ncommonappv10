import { Text, TouchableOpacity } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : colors.surface;
  const color = selected ? colors.primaryText : colors.text;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.pill,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: 10,
        marginBottom: 10,
        ...(selected ? shadow.card : {}),
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}
