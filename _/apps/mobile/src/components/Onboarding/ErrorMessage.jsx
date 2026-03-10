import { Text, View } from "react-native";
import { lightTheme } from "@/utils/theme";

const { colors, radius } = lightTheme;

export function ErrorMessage({ error }) {
  if (!error) return null;

  return (
    <View
      style={{
        backgroundColor: colors.dangerBg,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
        {error}
      </Text>
    </View>
  );
}
