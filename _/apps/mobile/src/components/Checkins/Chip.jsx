import { Text, TouchableOpacity } from "react-native";
import { colors, radii, shadow } from "@/utils/theme";

export function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : colors.card;
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
