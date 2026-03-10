import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii, shadow, spacing, typography } from "@/utils/theme";

export function LegalSection() {
  const router = useRouter();

  // We still compute base so we can optionally show a better error.
  const base =
    (typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_BASE_URL ||
        process.env.EXPO_PUBLIC_PROXY_BASE_URL
      : null) || null;

  const canOpen = !!(base || "").trim();

  const go = (doc) => {
    if (!canOpen) {
      Alert.alert("Link unavailable", "Could not determine the website URL.");
      return;
    }
    router.push({ pathname: "/legal", params: { doc } });
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Legal
      </Text>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <TouchableOpacity
          onPress={() => go("privacy")}
          activeOpacity={0.9}
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Privacy Policy
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            How we collect and use data.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => go("terms")}
          activeOpacity={0.9}
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.card,
            padding: spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Terms of Service
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            The rules for using nCommon.
          </Text>
        </TouchableOpacity>

        <View
          style={{
            paddingHorizontal: spacing.xxs,
            paddingTop: spacing.xxs,
          }}
        >
          <Text style={{ color: colors.subtext, ...typography.body.smBold }}>
            These open in the app.
          </Text>
        </View>
      </View>
    </View>
  );
}
