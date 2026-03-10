import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { WebView } from "react-native-webview";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";
import { safeBack } from "@/utils/navigation";

const { colors, radius, shadow, typography, spacing } = darkTheme;

function getWebBaseUrl() {
  const base =
    (typeof process !== "undefined" && process.env
      ? process.env.EXPO_PUBLIC_BASE_URL ||
        process.env.EXPO_PUBLIC_PROXY_BASE_URL
      : null) || null;

  if (!base) {
    return null;
  }

  return (base + "").trim().replace(/\/+$/, "");
}

function joinUrl(base, path) {
  const trimmedBase = (base || "").trim().replace(/\/+$/, "");
  const trimmedPath = (path || "").trim().replace(/^\/+/, "");
  if (!trimmedBase) {
    return null;
  }
  return `${trimmedBase}/${trimmedPath}`;
}

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [webError, setWebError] = useState(null);

  const doc = useMemo(() => {
    const raw = params?.doc;
    if (raw === "privacy" || raw === "terms" || raw === "safety") {
      return raw;
    }
    return "privacy";
  }, [params?.doc]);

  const title = useMemo(() => {
    if (doc === "terms") {
      return "Terms of Service";
    }
    if (doc === "safety") {
      return "Safety Tips";
    }
    return "Privacy Policy";
  }, [doc]);

  const url = useMemo(() => {
    const base = getWebBaseUrl();
    if (!base) {
      return null;
    }
    return joinUrl(base, doc);
  }, [doc]);

  const openInBrowser = async () => {
    if (!url) {
      Alert.alert("Link unavailable", "Could not determine the website URL.");
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "Cannot open link",
          "Your device could not open this link.",
        );
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.error(err);
      Alert.alert("Could not open link", "Please try again in a moment.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: insets.top }} />

      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.base,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => safeBack(router, "/")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.85)",
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.card,
          }}
        >
          <ChevronLeft size={18} color={colors.text} />
        </TouchableOpacity>

        <Text
          numberOfLines={1}
          style={{
            ...typography.heading.lg,
            color: colors.text,
          }}
        >
          {title}
        </Text>

        <TouchableOpacity
          onPress={openInBrowser}
          disabled={!url}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: url ? "rgba(255,255,255,0.85)" : "transparent",
            borderWidth: url ? 1 : 0,
            borderColor: colors.border,
            ...(url ? shadow.card : {}),
            opacity: url ? 1 : 0,
          }}
        >
          <ExternalLink size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {!url ? (
        <View style={{ padding: spacing.lg }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              ...shadow.card,
            }}
          >
            <Text style={{ ...typography.body.lgBold, color: colors.text }}>
              Link unavailable
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.subtext,
                ...typography.body.mdBold,
                lineHeight: 18,
              }}
            >
              We couldn't determine the website URL for the legal pages.
            </Text>
            <Text
              style={{
                marginTop: spacing.sm,
                color: colors.subtext,
                ...typography.body.mdBold,
                lineHeight: 18,
              }}
            >
              Fix: set EXPO_PUBLIC_BASE_URL to your published web domain.
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.9)",
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  ...shadow.card,
                }}
              >
                <ActivityIndicator color={colors.yellow} />
                <Text style={{ ...typography.body.lgBold, color: colors.text }}>
                  Loading…
                </Text>
              </View>
            </View>
          ) : null}

          {webError ? (
            <View
              style={{
                position: "absolute",
                left: spacing.md,
                right: spacing.md,
                top: spacing.md,
                zIndex: 50,
              }}
            >
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.md,
                  ...shadow.card,
                }}
              >
                <Text style={{ ...typography.body.lgBold, color: colors.text }}>
                  Could not load
                </Text>
                <Text
                  style={{
                    marginTop: spacing.xs,
                    color: colors.subtext,
                    ...typography.body.mdBold,
                    lineHeight: 18,
                  }}
                >
                  {webError}
                </Text>

                <TouchableOpacity
                  onPress={openInBrowser}
                  style={{
                    marginTop: spacing.base,
                    backgroundColor: colors.purple,
                    borderRadius: radius.md,
                    paddingVertical: spacing.base,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: colors.yellow, ...typography.body.lgBold }}
                  >
                    Open in browser
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <WebView
            source={{ uri: url }}
            onLoadStart={() => {
              setWebError(null);
              setIsLoading(true);
            }}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setWebError("Please check your connection and try again.");
              setIsLoading(false);
            }}
            onHttpError={(e) => {
              const code = e?.nativeEvent?.statusCode;
              if (code) {
                setWebError(`The page returned an error (${code}).`);
              } else {
                setWebError("The page returned an error.");
              }
              setIsLoading(false);
            }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={{ flex: 1, backgroundColor: colors.background }}
          />
        </View>
      )}

      <View style={{ height: insets.bottom }} />
    </View>
  );
}
