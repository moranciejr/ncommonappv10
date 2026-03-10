import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import authedFetch from "@/utils/authedFetch";
import useUser from "@/utils/auth/useUser";

function getRevenueCatApiKey() {
  // Prefer the Test Store key in the Anything development environment.
  if (process.env.EXPO_PUBLIC_CREATE_ENV === "DEVELOPMENT") {
    return process.env.EXPO_PUBLIC_REVENUE_CAT_TEST_STORE_API_KEY;
  }

  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUE_CAT_APP_STORE_API_KEY;
  }

  if (Platform.OS === "android") {
    return process.env.EXPO_PUBLIC_REVENUE_CAT_PLAY_STORE_API_KEY;
  }

  return process.env.EXPO_PUBLIC_REVENUE_CAT_TEST_STORE_API_KEY;
}

function tierFromCustomerInfo(customerInfo) {
  const active = customerInfo?.entitlements?.active || {};
  if (active.premium) return "premium";
  if (active.plus) return "plus";
  return "free";
}

export function useSubscription() {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const configuredRef = useRef(false);
  const lastSyncAtRef = useRef(0);

  const ensurePurchasesConfigured = useCallback(async () => {
    if (configuredRef.current) {
      return;
    }

    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      throw new Error(
        "In-app purchases are not configured yet. Please connect RevenueCat.",
      );
    }

    Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey });

    configuredRef.current = true;
  }, []);

  const claimTier = useCallback(async (tier) => {
    const response = await authedFetch("/api/billing/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, source: "iap" }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || response.statusText;
      throw new Error(
        `When fetching /api/billing/claim, the response was [${response.status}] ${msg}`,
      );
    }

    return data;
  }, []);

  const syncTierFromPurchases = useCallback(async () => {
    await ensurePurchasesConfigured();

    const userId = user?.id ? String(user.id) : null;
    if (userId) {
      try {
        await Purchases.logIn(userId);
        await Purchases.setAttributes({ userId });
      } catch (_err) {
        // non-fatal
      }
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const tier = tierFromCustomerInfo(customerInfo);
    await claimTier(tier);

    return { tier };
  }, [claimTier, ensurePurchasesConfigured, user?.id]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    if (!user?.id) {
      return;
    }

    const trySync = () => {
      const now = Date.now();
      const sixHours = 6 * 60 * 60 * 1000;
      if (lastSyncAtRef.current && now - lastSyncAtRef.current < sixHours) {
        return;
      }
      lastSyncAtRef.current = now;
      // Best-effort: keep the server tier in sync for gating (does not block UX).
      syncTierFromPurchases().catch(() => null);
    };

    // Run once on mount (deferred to next tick so render is not blocked).
    const mountTimer = setTimeout(trySync, 0);

    // Re-run when the app comes back to the foreground after being backgrounded.
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        trySync();
      }
    });

    return () => {
      clearTimeout(mountTimer);
      sub.remove();
    };
  }, [syncTierFromPurchases, user?.id]);

  const statusQuery = useQuery({
    queryKey: ["billingStatus"],
    queryFn: async () => {
      const response = await authedFetch("/api/billing/status", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/billing/status, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 1000 * 30,
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, redirectURL }) => {
      if (Platform.OS !== "web") {
        await ensurePurchasesConfigured();

        // Present RevenueCat paywall. (The paywall itself should offer Plus/Premium.)
        const result = await RevenueCatUI.presentPaywall();

        const didPurchase =
          result === PAYWALL_RESULT.PURCHASED ||
          result === PAYWALL_RESULT.RESTORED;

        if (didPurchase) {
          const synced = await syncTierFromPurchases();
          return { ok: true, mode: "iap", tier: synced.tier };
        }

        if (result === PAYWALL_RESULT.CANCELLED) {
          return { ok: false, mode: "iap", cancelled: true };
        }

        throw new Error("Upgrade did not complete.");
      }

      const response = await authedFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, redirectURL }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/billing/checkout, the response was [${response.status}] ${msg}`,
        );
      }
      return { ...data, mode: "stripe" };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (Platform.OS === "web") {
        return { ok: true, mode: "web" };
      }

      await ensurePurchasesConfigured();

      await Purchases.restorePurchases();
      const synced = await syncTierFromPurchases();

      return { ok: true, mode: "iap", tier: synced.tier };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
    },
  });

  const refetchSubscription = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["billingStatus"] });
    return queryClient.fetchQuery({ queryKey: ["billingStatus"] });
  }, [queryClient]);

  const startCheckout = useCallback(
    async ({ tier, redirectURL }) => {
      const data = await checkoutMutation.mutateAsync({ tier, redirectURL });
      return data;
    },
    [checkoutMutation],
  );

  const restorePurchases = useCallback(async () => {
    const data = await restoreMutation.mutateAsync();
    return data;
  }, [restoreMutation]);

  const tier = statusQuery.data?.tier || "free";
  const isPlus = tier === "plus";
  const isPremium = tier === "premium";

  const isProcessing = checkoutMutation.isPending || restoreMutation.isPending;

  return {
    tier,
    isPlus,
    isPremium,
    statusQuery,
    checkoutMutation,
    startCheckout,
    restorePurchases,
    isProcessing,
    refetchSubscription,
  };
}
