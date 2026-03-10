import { Text, TouchableOpacity, View } from "react-native";
import { colors, radii, shadow } from "@/utils/theme";

export default function ErrorNotice({
  message,
  onRetry,
  retryLabel = "Retry",
  style,
}) {
  const safeMessage = typeof message === "string" ? message.trim() : "";
  const canRetry = typeof onRetry === "function";

  if (!safeMessage) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.dangerBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "rgba(176,0,32,0.12)",
        ...(style || {}),
      }}
    >
      <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
        {safeMessage}
      </Text>

      {canRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={{
            marginTop: 10,
            alignSelf: "flex-start",
            backgroundColor: "rgba(255,255,255,0.9)",
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radii.button,
            ...shadow.card,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {retryLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
