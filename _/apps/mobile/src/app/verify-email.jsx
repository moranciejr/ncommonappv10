import { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/utils/auth/useAuth";
import authedFetch from "@/utils/authedFetch";
import { darkTheme } from "@/utils/theme";
import { shouldShowDevUi } from "@/utils/env";

const { colors, radius, shadow, typography, spacing } = darkTheme;

const LOGO_URL =
  "https://ucarecdn.com/18f829eb-8fe4-47a8-89b0-239a243cefa5/-/format/auto/";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { auth, setAuth, signOut } = useAuth();
  const { width } = useWindowDimensions();

  const showDevUi = useMemo(() => shouldShowDevUi(), []);

  const logoStyle = useMemo(() => {
    // Wordmark logo: render it BIG so it's comparable to the title text.
    const w = width || 390;
    const maxWidth = Math.max(300, Math.min(420, w - 44));
    const height = Math.max(84, Math.min(132, Math.round(maxWidth * 0.32)));
    return { width: maxWidth, height };
  }, [width]);

  const resendMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/email-verification/request", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/email-verification/request, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const refreshAuthMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/auth/token");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/auth/token, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      if (data?.jwt && data?.user) {
        setAuth({ jwt: data.jwt, user: data.user });
      }
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const verifyLink = resendMutation.data?.devVerifyLink;
  const isSending = resendMutation.isPending;
  const isRefreshing = refreshAuthMutation.isPending;

  const errorMessage = useMemo(() => {
    if (resendMutation.isPending) {
      return null;
    }

    // Hard error (401/500/etc)
    if (resendMutation.error) {
      return "Could not send verification email.";
    }

    // Soft error: endpoint responded but email provider rejected it
    if (resendMutation.data && resendMutation.data.emailSent === false) {
      return (
        resendMutation.data.message ||
        "We couldn't send the verification email right now."
      );
    }

    return null;
  }, [resendMutation.data, resendMutation.error, resendMutation.isPending]);

  const PrimaryButton = ({ title, onPress, disabled }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: colors.purple,
          paddingVertical: 14,
          borderRadius: radius.md,
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          ...shadow.card,
        }}
      >
        <Text
          style={{
            color: colors.yellow,
            ...typography.body.lgBold,
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const SecondaryButton = ({ title, onPress, disabled }) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: colors.surface,
          paddingVertical: 14,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          ...shadow.card,
        }}
      >
        <Text
          style={{
            color: colors.text,
            ...typography.body.lgBold,
          }}
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const onOpenVerifyLink = async () => {
    if (!verifyLink) {
      return;
    }
    try {
      await Linking.openURL(verifyLink);
    } catch (err) {
      console.error(err);
    }
  };

  const helpText = showDevUi
    ? "In production, this link will arrive by email. For now, you’ll see a dev link after you send."
    : "Check your inbox (and spam). After you click the link, come back and tap Continue.";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.md,
        paddingBottom: Math.max(spacing.md, insets.bottom + spacing.md),
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center", marginBottom: spacing.md }}>
        <Image
          source={{ uri: LOGO_URL }}
          style={logoStyle}
          contentFit="contain"
        />
        <Text
          style={{
            marginTop: spacing.md,
            ...typography.heading.xl,
            color: colors.text,
            textAlign: "center",
          }}
        >
          Verify your email
        </Text>
        <Text
          style={{
            marginTop: spacing.sm,
            ...typography.body.mdBold,
            color: colors.subtext,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          We'll send a verification link to {auth?.user?.email}.
        </Text>
      </View>

      {errorMessage ? (
        <Text
          style={{
            color: colors.error,
            marginBottom: spacing.sm,
            textAlign: "center",
            ...typography.body.mdBold,
          }}
        >
          {errorMessage}
        </Text>
      ) : null}

      <View style={{ gap: spacing.base }}>
        <PrimaryButton
          title={isSending ? "Sending…" : "Send verification email"}
          onPress={() => resendMutation.mutate()}
          disabled={isSending}
        />

        <SecondaryButton
          title={isRefreshing ? "Checking…" : "I verified — Continue"}
          onPress={() => refreshAuthMutation.mutate()}
          disabled={isRefreshing}
        />

        {showDevUi && verifyLink ? (
          <SecondaryButton
            title="Open verification link (dev)"
            onPress={onOpenVerifyLink}
          />
        ) : null}

        <SecondaryButton title="Sign Out" onPress={signOut} />
      </View>

      <Text
        style={{
          marginTop: spacing.md,
          ...typography.label.sm,
          color: "rgba(16,24,40,0.55)",
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {helpText}
      </Text>
    </View>
  );
}
