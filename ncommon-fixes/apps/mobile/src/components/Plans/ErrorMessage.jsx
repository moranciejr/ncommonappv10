import { Text, View } from "react-native";
import { darkTheme } from "@/utils/theme";
const { colors } = darkTheme;

export function ErrorMessage({ message }) {
  if (!message) return null;

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: "rgba(176,0,32,0.12)",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: "#FF6B6B", fontWeight: "800" }}>
        {message}
      </Text>
    </View>
  );
}
