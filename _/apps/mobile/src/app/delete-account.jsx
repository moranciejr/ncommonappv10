import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { darkTheme } from "@/utils/theme";
import authedFetch from "@/utils/authedFetch";
import { useAuth } from "@/utils/auth/useAuth";
import { safeBack } from "@/utils/navigation";

const { colors, radius, shadow, typography, spacing } = darkTheme;

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = useMemo(() => {
    return confirmText.trim().toUpperCase() === "DELETE";
  }, [confirmText]);

  const onDelete = useCallback(async () => {
    if (isDeleting || !canDelete) {
      return;
    }

    Alert.alert("Delete account now?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setIsDeleting(true);

            const response = await authedFetch("/api/account/delete", {
              method: "POST",
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              const msg = data?.error || response.statusText;
              throw new Error(
                `When fetching /api/account/delete, the response was [${response.status}] ${msg}`,
              );
            }

            Alert.alert(
              "Account deleted",
              "Your account has been removed. You'll be signed out.",
            );

            try {
              await signOut();
            } catch (_err) {
              // ignore
            }

            router.replace("/");
          } catch (err) {
            console.error(err);
            Alert.alert("Could not delete", "Please try again.");
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  }, [canDelete, isDeleting, router, signOut]);

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ height: insets.top }} />

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.base,
            paddingBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => safeBack(router, "/settings")}
            style={{
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              ...shadow.card,
            }}
          >
            <Text style={{ ...typography.body.lgBold, color: colors.text }}>
              Back
            </Text>
          </TouchableOpacity>

          <Text style={{ ...typography.heading.lg, color: colors.text }}>
            Delete account
          </Text>

          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 28,
            paddingTop: spacing.sm,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: "rgba(239,68,68,0.07)",
              borderWidth: 1,
              borderColor: "rgba(239,68,68,0.30)",
              borderRadius: radius.xl,
              padding: spacing.md,
            }}
          >
            <Text style={{ ...typography.body.lgBold, color: colors.error }}>
              This is permanent
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.subtext,
                ...typography.body.mdBold,
                lineHeight: 18,
              }}
            >
              Deleting your account removes your profile, photos, interests,
              plans, and related notifications. It also signs you out on all
              devices.
            </Text>
          </View>

          {step === 1 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.base }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  ...shadow.card,
                }}
              >
                <Text style={{ ...typography.body.lgBold, color: colors.text }}>
                  What gets deleted
                </Text>
                <Text
                  style={{
                    marginTop: spacing.sm,
                    color: colors.subtext,
                    ...typography.body.mdBold,
                    lineHeight: 18,
                  }}
                >
                  • Profile + photos\n• Interests\n• Plans + requests\n•
                  Messages and notifications tied to your account
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setStep(2)}
                style={{
                  backgroundColor: colors.purple,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                  ...shadow.card,
                }}
              >
                <Text
                  style={{ ...typography.body.lgBold, color: colors.yellow }}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md, gap: spacing.base }}>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  ...shadow.card,
                }}
              >
                <Text style={{ ...typography.body.lgBold, color: colors.text }}>
                  Type DELETE to confirm
                </Text>
                <Text
                  style={{
                    marginTop: spacing.xs,
                    color: colors.subtext,
                    ...typography.body.mdBold,
                    lineHeight: 18,
                  }}
                >
                  This helps prevent accidental taps.
                </Text>

                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="DELETE"
                  placeholderTextColor={"rgba(0,0,0,0.35)"}
                  style={{
                    marginTop: spacing.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.base,
                    paddingVertical: spacing.base,
                    ...typography.body.lgBold,
                    color: colors.text,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={onDelete}
                disabled={!canDelete || isDeleting}
                style={{
                  backgroundColor: "rgba(239,68,68,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(239,68,68,0.35)",
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                  opacity: !canDelete || isDeleting ? 0.6 : 1,
                  ...shadow.card,
                }}
              >
                {isDeleting ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <Text
                    style={{ ...typography.body.lgBold, color: colors.error }}
                  >
                    Delete my account
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep(1)}
                disabled={isDeleting}
                style={{
                  alignItems: "center",
                  paddingVertical: spacing.sm,
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ ...typography.body.lgBold, color: colors.subtext }}
                >
                  Go back
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
