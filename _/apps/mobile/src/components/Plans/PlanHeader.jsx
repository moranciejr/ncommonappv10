import { Text, TouchableOpacity, View } from "react-native";
import { ArrowLeft, MoreHorizontal } from "lucide-react-native";
import { colors, shadow } from "@/utils/theme";

export function PlanHeader({ title, onBack, onMore }) {
  return (
    <View
      style={{
        marginTop: 12,
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
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          ...shadow.card,
        }}
      >
        <ArrowLeft size={20} color={colors.text} />
      </TouchableOpacity>

      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
        {title}
      </Text>

      {typeof onMore === "function" ? (
        <TouchableOpacity
          onPress={onMore}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            ...shadow.card,
          }}
        >
          <MoreHorizontal size={20} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 44 }} />
      )}
    </View>
  );
}
