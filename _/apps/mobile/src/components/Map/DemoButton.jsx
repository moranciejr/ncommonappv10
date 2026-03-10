import { View, Text, TouchableOpacity } from "react-native";
import { colors, shadow } from "@/utils/theme";

export function DemoButton({ seedMutation }) {
  return (
    <View style={{ position: "absolute", right: 16, bottom: 110 }}>
      <TouchableOpacity
        onPress={() => seedMutation.mutate()}
        disabled={seedMutation.isPending}
        style={{
          backgroundColor: colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 999,
          opacity: seedMutation.isPending ? 0.7 : 1,
          ...shadow.card,
        }}
      >
        <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
          {seedMutation.isPending ? "Seeding…" : "Demo"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
