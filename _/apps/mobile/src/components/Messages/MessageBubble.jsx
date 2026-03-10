import { Text, View } from "react-native";
import { darkTheme } from "@/utils/theme";
import { formatTime } from "@/utils/conversationUtils";

const { colors, typography, spacing } = darkTheme;

export function MessageBubble({ message, isMine }) {
  const body = message.body || "";
  const time = formatTime(message.created_at);

  const bg = isMine ? colors.purple : "rgba(255,255,255,0.98)";
  const color = isMine ? colors.yellow : colors.text;
  const align = isMine ? "flex-end" : "flex-start";
  const borderColor = isMine ? "rgba(45,17,77,0.55)" : colors.border;

  return (
    <View
      key={String(message.id)}
      style={{ alignSelf: align, maxWidth: "86%" }}
    >
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.sm,
        }}
      >
        <Text style={{ color, ...typography.body.mdBold, lineHeight: 18 }}>
          {body}
        </Text>
        {time ? (
          <Text
            style={{
              marginTop: spacing.xs,
              color: isMine ? "rgba(255,255,255,0.70)" : "rgba(16,24,40,0.45)",
              ...typography.label.xs,
            }}
          >
            {time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
