import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, spacing, typography } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function AccountSection({
  clearActivityMutation,
  deleteAccountMutation,
}) {
  const router = useRouter();

  const handleViewIntro = () => {
    router.push("/intro");
  };

  const handleClearActivity = () => {
    Alert.alert(
      "Clear activity?",
      "This clears notifications and view history. It won't delete your profile or plans.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearActivityMutation.mutate(),
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    // App Store requirement: dedicated 2-step flow.
    router.push("/delete-account");
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={{ ...typography.body.lgBold, color: colors.text }}>
        Account
      </Text>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <TouchableOpacity
          onPress={handleViewIntro}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            View introduction
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Rewatch the intro slides or show them to a friend.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClearActivity}
          disabled={clearActivityMutation.isPending}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.md,
            opacity: clearActivityMutation.isPending ? 0.6 : 1,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Clear activity history
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Clears notifications and view history. Helpful if you want a fresh
            start.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleteAccountMutation.isPending}
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            borderWidth: 1,
            borderColor: "rgba(239,68,68,0.35)",
            borderRadius: radii.xl,
            padding: spacing.md,
            opacity: deleteAccountMutation.isPending ? 0.6 : 1,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: "#FF6B6B" }}>
            Delete account
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Permanent and cannot be undone.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
