import { View, Text } from "react-native";
import { colors, radii, shadow } from "@/utils/theme";

export function EmptyMapNotice({ showDevActions }) {
  const emptyMapBody = showDevActions
    ? "Tap Demo to load a sample crowd."
    : "Try zooming in, changing your interest filter, or posting a plan.";

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 110,
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.97)",
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: radii.button,
          maxWidth: 360,
          ...shadow.card,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          Nothing on the map yet
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
            fontSize: 12,
          }}
        >
          {emptyMapBody}
        </Text>
      </View>
    </View>
  );
}
