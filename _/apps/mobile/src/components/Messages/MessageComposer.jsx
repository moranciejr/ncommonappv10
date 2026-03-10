import { Animated, TextInput, TouchableOpacity, View } from "react-native";
import { Send } from "lucide-react-native";
import { colors, radii, shadow } from "@/utils/theme";

export function MessageComposer({
  draft,
  onChangeDraft,
  onSend,
  isSending,
  canSend,
  inputDisabled,
  paddingAnimation,
  onFocus,
  onBlur,
  inputRef,
}) {
  const locked = inputDisabled === true;
  const disabled = locked || isSending || !canSend;

  const placeholder = locked ? "Chat unavailable" : "Message…";

  return (
    <Animated.View
      style={{
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: paddingAnimation,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderTopWidth: 1,
        borderColor: colors.border,
        transform: [{ translateY: 0 }],
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={onChangeDraft}
          editable={!locked}
          placeholder={placeholder}
          placeholderTextColor="#9A9AA0"
          multiline
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 120,
            borderWidth: 1,
            borderColor: "rgba(16,24,40,0.12)",
            borderRadius: radii.button,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "#FFFFFF",
            color: colors.text,
            fontSize: 15,
            fontWeight: "700",
            opacity: locked ? 0.6 : 1,
          }}
          returnKeyType="send"
        />

        <TouchableOpacity
          onPress={onSend}
          disabled={disabled}
          style={{
            width: 46,
            height: 46,
            borderRadius: radii.button,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            opacity: disabled ? 0.45 : 1,
            ...shadow.card,
          }}
        >
          <Send size={18} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
