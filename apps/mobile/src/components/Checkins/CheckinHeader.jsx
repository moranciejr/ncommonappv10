import { View, Text, TouchableOpacity } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function CheckinHeader({ onBack }) {
  return (
    <View
      style={{
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          ...shadow.card,
        }}
      >
        <ArrowLeft size={20} color={colors.text} />
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
          Post a plan
        </Text>
        <Text
          style={{
            marginTop: 6,
            fontSize: 13,
            color: colors.subtext,
            lineHeight: 18,
            fontWeight: "700",
          }}
        >
          Tell nCommoners what you're in the mood to do.
        </Text>
      </View>

      <View style={{ width: 44 }} />
    </View>
  );
}
