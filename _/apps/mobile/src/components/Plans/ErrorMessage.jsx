import { Text, View } from "react-native";
import { colors } from "@/utils/theme";

export function ErrorMessage({ message }) {
  if (!message) return null;

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: colors.dangerBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
        {message}
      </Text>
    </View>
  );
}
