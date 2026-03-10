import { Text, View } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function ErrorMessage({ error }) {
  if (!error) return null;

  return (
    <View
      style={{
        backgroundColor: "rgba(176,0,32,0.12)",
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: "#FF6B6B", fontWeight: "700" }}>
        {error}
      </Text>
    </View>
  );
}
