import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useSubscription } from "@/hooks/useSubscription";
import { colors, radii, shadow } from "@/utils/theme";
import { safeBack } from "@/utils/navigation";

export default function StripeCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refetchSubscription } = useSubscription();

  const [isLoading, setIsLoading] = useState(true);
  const [webError, setWebError] = useState(null);

  const checkoutUrl = useMemo(() => {
    const raw = params?.checkoutUrl;
    if (typeof raw === "string") {
      return raw;
    }
    return null;
  }, [params?.checkoutUrl]);

  const appBase = useMemo(() => {
    const base = process.env.EXPO_PUBLIC_BASE_URL;
    if (typeof base === "string") {
      return base;
    }
    return null;
  }, []);

  const closeAndRefresh = async () => {
    try {
      await refetchSubscription();
    } catch (err) {
      console.error(err);
    }
    safeBack(router, "/upgrade");
  };

  // Web: open as popup.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    if (!checkoutUrl) {
      safeBack(router, "/upgrade");
      return;
    }

    const popup = window.open(checkoutUrl, "_blank", "popup");
    const checkClosed = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(checkClosed);
          closeAndRefresh();
          return;
        }
        if (appBase && popup.location.href.startsWith(appBase)) {
          clearInterval(checkClosed);
          popup.close();
          closeAndRefresh();
        }
      } catch (_e) {
        // ignore cross-origin
      }
    }, 1000);

    return () => {
      try {
        clearInterval(checkClosed);
      } catch (_e) {}
    };
  }, [appBase, checkoutUrl, router]);

  // For iOS/Android App Store builds, upgrades must use in-app purchases.
  // This screen is kept for web-only Stripe checkout.
  if (Platform.OS !== "web") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          Checkout isn’t available here
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          Upgrades are handled with in-app purchases.
        </Text>
        <TouchableOpacity
          onPress={() => safeBack(router, "/upgrade")}
          style={{
            marginTop: 14,
            backgroundColor: colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radii.button,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.primaryText }}>
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleShouldStartLoadWithRequest = (request) => {
    if (!appBase) {
      return true;
    }

    if (typeof request?.url === "string" && request.url.startsWith(appBase)) {
      closeAndRefresh();
      return false;
    }

    return true;
  };

  if (!checkoutUrl) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          Could not open checkout
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          Please go back and try again.
        </Text>
        <TouchableOpacity
          onPress={() => safeBack(router, "/upgrade")}
          style={{
            marginTop: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: radii.button,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            zIndex: 10,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              ...shadow.card,
            }}
          >
            <ActivityIndicator />
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Loading checkout…
            </Text>
          </View>
        </View>
      ) : null}

      {webError ? (
        <View style={{ padding: 16 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radii.card,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              ...shadow.card,
            }}
          >
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Could not load checkout
            </Text>
            <Text
              style={{
                marginTop: 6,
                color: colors.subtext,
                fontWeight: "700",
                lineHeight: 18,
              }}
            >
              {webError}
            </Text>
            <TouchableOpacity
              onPress={() => safeBack(router, "/upgrade")}
              style={{
                marginTop: 12,
                backgroundColor: colors.primary,
                borderRadius: radii.button,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                Go back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <WebView
        source={{ uri: checkoutUrl }}
        style={{ flex: 1, backgroundColor: colors.background }}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        startInLoadingState={true}
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
          setWebError(
            code
              ? `The page returned an error (${code}).`
              : "The page returned an error.",
          );
          setIsLoading(false);
        }}
      />
    </View>
  );
}
