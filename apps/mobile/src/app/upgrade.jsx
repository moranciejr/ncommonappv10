import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, Crown, Sparkles, Zap, HelpCircle } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { useSubscription } from "@/hooks/useSubscription";
import {
  approxDistanceLabelFromKm,
  useDistanceUnit,
} from "@/hooks/useAppSettings";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { Platform } from "react-native";

function Bullet({ children }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <Check size={16} color={colors.accent} style={{ marginTop: 2 }} />
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontWeight: "700",
          lineHeight: 18,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function TierCard({
  title,
  price,
  badge,
  bullets,
  primary,
  ctaLabel,
  onPressCta,
  disabled,
}) {
  const borderColor = primary ? "rgba(139,92,246,0.22)" : colors.border;

  const badgeNode = badge ? (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: primary ? colors.chipBg : colors.mutedBg,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "900",
          color: primary ? colors.primary : colors.text,
        }}
      >
        {badge}
      </Text>
    </View>
  ) : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor,
        borderRadius: radii.xl,
        padding: 14,
        ...shadow.card,
      }}
    >
      {badgeNode}

      <View style={{ marginTop: badgeNode ? 10 : 0 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
          {title}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 14,
            fontWeight: "800",
            color: colors.subtext,
          }}
        >
          {price}
        </Text>
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        {bullets.map((b) => (
          <Bullet key={b}>{b}</Bullet>
        ))}
      </View>

      <TouchableOpacity
        onPress={onPressCta}
        disabled={disabled}
        style={{
          marginTop: 14,
          backgroundColor: primary ? colors.primary : colors.mutedBg,
          borderRadius: radii.lg,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: primary ? colors.primary : colors.border,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            fontWeight: "900",
            color: primary ? colors.primaryText : colors.text,
          }}
        >
          {ctaLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function CompareRow({ label, free, plus, premium }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontWeight: "900", color: colors.text }}>{label}</Text>
      <View
        style={{
          marginTop: 8,
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Text style={{ flex: 1, color: colors.subtext, fontWeight: "700" }}>
          Free: {free}
        </Text>
        <Text style={{ flex: 1, color: colors.subtext, fontWeight: "700" }}>
          Plus: {plus}
        </Text>
        <Text style={{ flex: 1, color: colors.subtext, fontWeight: "700" }}>
          Premium: {premium}
        </Text>
      </View>
    </View>
  );
}

function FaqItem({ title, body, open, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.9}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.xl,
        padding: 14,
        ...shadow.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <HelpCircle size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontWeight: "900", color: colors.text }}>
          {title}
        </Text>
      </View>
      {open ? (
        <Text
          style={{
            marginTop: 10,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          {body}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tier, statusQuery, startCheckout, isProcessing, restorePurchases } =
    useSubscription();

  const { unit: distanceUnit } = useDistanceUnit();

  const [openFaq, setOpenFaq] = useState("history");

  const redirectURL = useMemo(() => {
    // Stripe checkout is only used on web builds.
    if (Platform.OS !== "web") {
      return null;
    }

    const base = process.env.EXPO_PUBLIC_BASE_URL;
    if (typeof base === "string" && base.startsWith("http")) {
      return `${base}/billing/success`;
    }
    return null;
  }, []);

  const isLoading = statusQuery.isLoading;
  const currentPlanLabel = useMemo(() => {
    if (tier === "premium") return "Premium";
    if (tier === "plus") return "Plus";
    return "Free";
  }, [tier]);

  const plusCtaLabel = useMemo(() => {
    if (tier === "plus") {
      return "You’re on Plus";
    }
    if (tier === "premium") {
      return "Included in Premium";
    }
    return "Get Plus";
  }, [tier]);

  const premiumCtaLabel = useMemo(() => {
    if (tier === "premium") {
      return "You’re on Premium";
    }
    return "Get Premium";
  }, [tier]);

  const beginCheckout = useCallback(
    async (nextTier) => {
      try {
        const data = await startCheckout({ tier: nextTier, redirectURL });

        if (data?.mode === "stripe") {
          const url = data?.url;
          if (!url) {
            throw new Error("No checkout URL returned");
          }
          router.push({ pathname: "/stripe", params: { checkoutUrl: url } });
          return;
        }

        if (data?.mode === "iap") {
          if (data?.cancelled) {
            return;
          }

          Alert.alert(
            "Upgrade complete",
            "Your subscription is active. Thanks for supporting nCommon.",
          );
          return;
        }
      } catch (err) {
        console.error(err);
        const message =
          typeof err?.message === "string" && err.message
            ? err.message
            : "Please try again.";
        Alert.alert("Could not start upgrade", message);
      }
    },
    [redirectURL, router, startCheckout],
  );

  const mapFree = useMemo(() => {
    return approxDistanceLabelFromKm(5, distanceUnit);
  }, [distanceUnit]);

  const mapPlus = useMemo(() => {
    return approxDistanceLabelFromKm(40, distanceUnit);
  }, [distanceUnit]);

  const mapPremium = useMemo(() => {
    return approxDistanceLabelFromKm(120, distanceUnit);
  }, [distanceUnit]);

  // Matches the tiers you shared.
  const freeBullets = [
    "25 profile views / 24h",
    "10 plan pin views / 24h",
    `Map radius ${mapFree}`,
    "1 active plan at a time",
    "Activity history: last 20 notifications",
  ];

  const plusBullets = [
    "Unlimited profile browsing",
    "Plan view alerts (get notified)",
    "See who viewed your plans (insights)",
    `Map radius ${mapPlus}`,
    "Up to 3 active plans at once",
    "Activity history: last 75 notifications",
  ];

  const premiumBullets = [
    "Everything in Plus",
    `Map radius ${mapPremium}`,
    "Up to 10 active plans at once",
    "Activity history: last 200 notifications",
    "Priority visibility (coming next)",
  ];

  const faq = [
    {
      id: "history",
      title: "What do I get by upgrading?",
      body: "More range on the map, more active plans at once, and insights like seeing who viewed your plans — so meetups happen faster.",
    },
    {
      id: "limits",
      title: "Why are there limits on Free?",
      body: "Limits prevent spam and keep the community high-quality. They also help you upgrade only when you’re actively using the app.",
    },
    {
      id: "cancel",
      title: "Can I cancel anytime?",
      body:
        Platform.OS === "web"
          ? "Yep. You can cancel during checkout. Your plan stays active until the end of the billing period."
          : "Yep. You can cancel anytime in your Apple ID subscriptions (Settings → Apple ID → Subscriptions). Your plan stays active until the end of the billing period.",
    },
  ];

  const statusErrorMessage = useMemo(() => {
    if (!statusQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      statusQuery.error,
      "Could not load subscription status.",
    );
  }, [statusQuery.error]);

  const onRetryStatus = useCallback(() => {
    try {
      if (typeof statusQuery.refetch === "function") {
        statusQuery.refetch();
      }
    } catch (err) {
      console.error(err);
    }
  }, [statusQuery]);

  const plusPriceLabel = useMemo(() => {
    if (Platform.OS === "web") {
      return "$6.99 / month";
    }
    return "See pricing in the App Store";
  }, []);

  const premiumPriceLabel = useMemo(() => {
    if (Platform.OS === "web") {
      return "$14.99 / month";
    }
    return "See pricing in the App Store";
  }, []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={{
            marginTop: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: 14,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Sparkles size={18} color={colors.primary} />
            <Text
              style={{ fontSize: 22, fontWeight: "900", color: colors.text }}
            >
              Upgrade
            </Text>
          </View>

          <Text
            style={{
              marginTop: 6,
              fontSize: 13,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            Current plan: {currentPlanLabel}
          </Text>

          <ErrorNotice
            message={statusErrorMessage}
            onRetry={statusQuery.error ? onRetryStatus : null}
            style={statusErrorMessage ? { marginTop: 12 } : null}
          />
        </View>

        {/* Plans */}
        <View style={{ marginTop: 14, gap: 12 }}>
          <TierCard
            title="nCommon Basic"
            price="$0 / month"
            badge="Free"
            bullets={freeBullets}
            primary={false}
            ctaLabel={tier === "free" ? "You’re on Free" : "Current"}
            onPressCta={() => {}}
            disabled
          />

          <TierCard
            title="nCommon Plus"
            price={plusPriceLabel}
            badge="Most popular"
            bullets={plusBullets}
            primary={tier !== "premium"}
            ctaLabel={plusCtaLabel}
            onPressCta={() => beginCheckout("plus")}
            disabled={isProcessing || tier === "plus" || tier === "premium"}
          />

          <TierCard
            title="nCommon Premium"
            price={premiumPriceLabel}
            badge="Best value"
            bullets={premiumBullets}
            primary={true}
            ctaLabel={premiumCtaLabel}
            onPressCta={() => beginCheckout("premium")}
            disabled={isProcessing || tier === "premium"}
          />
        </View>

        {/* Compare */}
        <View
          style={{
            marginTop: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: 14,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }}>
            Compare plans
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            Built for social discovery — upgrade only when it’s worth it.
          </Text>

          <CompareRow
            label="Profile browsing"
            free="25/day"
            plus="Unlimited"
            premium="Unlimited"
          />
          <CompareRow
            label="Plan pin browsing"
            free="10/day"
            plus="Unlimited"
            premium="Unlimited"
          />
          <CompareRow
            label="Active plans at once"
            free="1"
            plus="3"
            premium="10"
          />
          <CompareRow
            label="Plan insights (see viewers)"
            free="Locked"
            plus="Included"
            premium="Included"
          />
          <CompareRow
            label="Plan view alerts"
            free="Locked"
            plus="Included"
            premium="Included"
          />
          <CompareRow
            label="Map radius"
            free={mapFree}
            plus={mapPlus}
            premium={mapPremium}
          />
          <CompareRow
            label="Activity history"
            free="20"
            plus="75"
            premium="200"
          />
        </View>

        {/* Add-ons (visual only for now) */}
        <View
          style={{
            marginTop: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: 14,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Zap size={16} color={colors.primary} />
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Optional boosts
            </Text>
          </View>
          <Text
            style={{
              marginTop: 6,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            Coming next: profile boost, event blast, chat saver, extra photos.
          </Text>
        </View>

        {/* Safety note */}
        <View
          style={{
            marginTop: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: 14,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Crown size={16} color={colors.primary} />
            <Text style={{ fontWeight: "900", color: colors.text }}>
              Safety stays free
            </Text>
          </View>
          <Text
            style={{
              marginTop: 6,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            Blocking and reporting are always available. Safety rules always
            apply.
          </Text>
        </View>

        {/* FAQ */}
        <View style={{ marginTop: 14, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
            FAQ
          </Text>
          {faq.map((item) => (
            <FaqItem
              key={item.id}
              title={item.title}
              body={item.body}
              open={openFaq === item.id}
              onToggle={() =>
                setOpenFaq((cur) => (cur === item.id ? null : item.id))
              }
            />
          ))}
        </View>

        {Platform.OS !== "web" ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                await restorePurchases();
                Alert.alert(
                  "Restored",
                  "We checked your purchases. If you have an active subscription, it will show as Plus or Premium shortly.",
                );
              } catch (err) {
                console.error(err);
                Alert.alert("Could not restore", "Please try again.");
              }
            }}
            disabled={isProcessing}
            style={{
              marginTop: 18,
              alignItems: "center",
              paddingVertical: 12,
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "900" }}>
              Restore purchases
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 14, alignItems: "center", paddingVertical: 12 }}
        >
          <Text style={{ color: colors.primary, fontWeight: "900" }}>
            Not now
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
