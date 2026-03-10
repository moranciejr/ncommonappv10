import { ActivityIndicator, Text, View } from "react-native";
import { Image } from "expo-image";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

export function PhotoStep({
  avatarPreviewUri,
  avatarUrl,
  pickedPreviewNonce,
  pickImage,
  uploadLoading,
  pickedAsset,
  uploadAvatar,
}) {
  return (
    <View>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.mutedBg,
          borderRadius: radius.lg,
          padding: spacing.base,
        }}
      >
        {(() => {
          const previewUri = avatarPreviewUri || avatarUrl;
          const previewKey = `${previewUri || "none"}-${pickedPreviewNonce}`;

          if (previewUri) {
            return (
              <Image
                key={previewKey}
                source={{ uri: previewUri }}
                style={{ width: "100%", height: 220, borderRadius: radius.md }}
                contentFit="cover"
                onError={(e) => {
                  console.error("Preview image failed to load", e);
                }}
              />
            );
          }

          return (
            <View
              style={{
                width: "100%",
                height: 220,
                borderRadius: radius.md,
                backgroundColor: colors.chipBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.subtext, ...typography.label.md }}>
                No photo yet
              </Text>
            </View>
          );
        })()}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <SecondaryButton title="Pick a photo" onPress={pickImage} />

          {uploadLoading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xs }}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={{
                  marginTop: spacing.sm,
                  ...typography.caption.md,
                  color: colors.subtext,
                }}
              >
                Uploading…
              </Text>
            </View>
          ) : null}

          {pickedAsset && !uploadLoading ? (
            <PrimaryButton
              title="Retry upload"
              onPress={uploadAvatar}
              disabled={uploadLoading}
            />
          ) : null}

          <Text
            style={{
              ...typography.caption.md,
              color: colors.mutedText,
              lineHeight: 16,
            }}
          >
            We don't show your email. A photo is optional, but it helps cut down
            fake accounts.
          </Text>
        </View>
      </View>
    </View>
  );
}
