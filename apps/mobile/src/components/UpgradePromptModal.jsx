import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Sparkles, X } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export default function UpgradePromptModal({
  visible,
  title,
  message,
  bullets,
  primaryText = "Upgrade",
  secondaryText = "Not now",
  onPrimary,
  onClose,
}) {
  const safeBullets = Array.isArray(bullets) ? bullets.filter(Boolean) : [];

  return (
    <Modal
      visible={!!visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(10, 20, 30, 0.35)",
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            ...shadow.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.chipBg,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(139,92,246,0.14)",
                }}
              >
                <Sparkles size={18} color={colors.primary} />
              </View>
              <Text
                style={{ fontSize: 16, fontWeight: "900", color: colors.text }}
              >
                {title || "Upgrade"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
              }}
            >
              <X size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          {message ? (
            <Text
              style={{
                marginTop: 12,
                fontSize: 13,
                lineHeight: 18,
                fontWeight: "700",
                color: colors.subtext,
              }}
            >
              {message}
            </Text>
          ) : null}

          {safeBullets.length ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              {safeBullets.map((b, idx) => (
                <View
                  key={`b-${idx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      backgroundColor: colors.primary,
                      marginTop: 6,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>
                {secondaryText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onPrimary}
              style={{
                flex: 1,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.primary,
                backgroundColor: colors.primary,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                ...shadow.card,
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.primaryText }}>
                {primaryText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
