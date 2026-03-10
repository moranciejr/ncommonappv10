import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { colors, radii, shadow } from "@/utils/theme";
import { safeBack } from "@/utils/navigation";
import { initialsFromName } from "@/utils/nameUtils";
import { invalidateMany } from "@/utils/retryQueries";
import { usePlanId } from "@/hooks/usePlanId";
import { usePlanQuery } from "@/hooks/usePlanQuery";
import { usePlanInsights } from "@/hooks/usePlanInsights";
import { usePlanRequest } from "@/hooks/usePlanRequest";
import { usePlanRespond } from "@/hooks/usePlanRespond";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { PlanHeader } from "@/components/Plans/PlanHeader";
import { ErrorMessage } from "@/components/Plans/ErrorMessage";
import { UpgradePrompt } from "@/components/Plans/UpgradePrompt";
import { PlanCard } from "@/components/Plans/PlanCard";
import { PlanInsights } from "@/components/Plans/PlanInsights";
import { PlanRequests } from "@/components/Plans/PlanRequests";
import { Inbox, Sparkles } from "lucide-react-native";
import { useNCommonWithUser } from "@/hooks/useNCommonWithUser";
import { Pill } from "@/components/Plans/Pill";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { ConfirmMeetupModal } from "@/components/Meetups/ConfirmMeetupModal";

export default function PlanDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();

  const rawId = params?.id;
  const planId = usePlanId(rawId);

  const tabParam = useMemo(() => {
    const t = params?.tab;
    if (typeof t === "string") {
      return t;
    }
    if (Array.isArray(t) && typeof t[0] === "string") {
      return t[0];
    }
    return null;
  }, [params?.tab]);

  const highlightRequestId = useMemo(() => {
    const rid = params?.requestId;
    const raw = Array.isArray(rid) ? rid[0] : rid;
    const n = parseInt(String(raw || ""), 10);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }, [params?.requestId]);

  // showMeetupConfirm=1 is set when the user taps a meetup_prompt push notification.
  const showMeetupConfirmParam = useMemo(() => {
    const v = params?.showMeetupConfirm;
    const raw = Array.isArray(v) ? v[0] : v;
    return raw === "1" || raw === "true";
  }, [params?.showMeetupConfirm]);

  const scrollRef = useRef(null);
  const [requestsY, setRequestsY] = useState(null);

  // NEW: transient “why am I here?” hint banner state
  const [requestsBannerVisible, setRequestsBannerVisible] = useState(false);
  const bannerTimeoutRef = useRef(null);
  const lastBannerKeyRef = useRef(null);

  // Meetup confirmation modal
  const [meetupModalVisible, setMeetupModalVisible] = useState(false);

  // Auto-open modal when arriving from a meetup_prompt push notification.
  useEffect(() => {
    if (showMeetupConfirmParam && checkin && !planQuery.isLoading) {
      setMeetupModalVisible(true);
    }
  }, [showMeetupConfirmParam, checkin, planQuery.isLoading]);

  // Accepted attendees for the modal (excluding the current user).
  const meetupAttendees = useMemo(() => {
    if (!checkin) return [];
    const attendees = [];
    // Include host when viewer is not the host.
    if (!isMine && checkin.userId && checkin.displayName) {
      attendees.push({
        userId: checkin.userId,
        displayName: checkin.displayName,
        avatarUrl: checkin.avatarUrl || "",
      });
    }
    // Include accepted join requesters.
    const requests = Array.isArray(checkin.requests) ? checkin.requests : [];
    for (const r of requests) {
      if (r.status === "accepted" && r.requesterUserId) {
        attendees.push({
          userId: r.requesterUserId,
          displayName: r.displayName || "",
          avatarUrl: r.avatarUrl || "",
        });
      }
    }
    return attendees;
  }, [checkin, isMine]);

  // Host taps "End plan early" to trigger meetup confirmation before expiry.
  const onEndPlanEarly = useCallback(() => {
    if (!isMine) return;
    Alert.alert(
      "End plan early?",
      "You and your attendees can confirm the meetup now.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End & confirm meetups",
          onPress: () => setMeetupModalVisible(true),
        },
      ],
    );
  }, [isMine]);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (tabParam !== "requests") {
      return;
    }
    if (typeof requestsY !== "number") {
      return;
    }

    const t = setTimeout(() => {
      try {
        scrollRef.current?.scrollTo?.({
          y: Math.max(0, requestsY - 10),
          animated: true,
        });
      } catch (_err) {
        // ignore
      }
    }, 250);

    return () => clearTimeout(t);
  }, [requestsY, tabParam]);

  const refreshKeys = useMemo(() => {
    if (!planId) {
      return [];
    }
    return [
      ["checkin", { id: planId }],
      ["checkinInsights", { id: planId }],
    ];
  }, [planId]);

  const { refreshControl } = usePullToRefresh({
    queryKeys: refreshKeys,
  });

  const [uiError, setUiError] = useState(null);
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const hasShownPromptRef = useRef(false);

  const planQuery = usePlanQuery(planId);

  // Keep checkin available for mutations (and avoid referencing it before initialization).
  const checkin = planQuery.data?.checkin || null;

  useEffect(() => {
    const nudge = planQuery.data?.upgradeNudge;
    if (!nudge) {
      return;
    }
    if (hasShownPromptRef.current) {
      return;
    }
    hasShownPromptRef.current = true;
    setUpgradePrompt(nudge);
  }, [planQuery.data?.upgradeNudge]);

  const requestMutation = usePlanRequest(
    planId,
    setUiError,
    (nudge) => {
      setUpgradePrompt(nudge);
    },
    null,
  );

  const respondMutation = usePlanRespond(planId);

  // NEW: for "Message host" CTA if conversationId is missing (legacy data)
  const startConversationMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/messages/conversations, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onError: (err) => {
      console.error(err);
      setUiError("Could not open chat.");
    },
  });

  // NEW: nCommon for the plan host
  const ncommonTargetUserId = !checkin?.isMine ? checkin?.userId : null;
  const ncommonQuery = useNCommonWithUser(ncommonTargetUserId);

  const ncommonCount = useMemo(() => {
    const n = ncommonQuery.data?.overlapCount;
    return typeof n === "number" ? n : null;
  }, [ncommonQuery.data?.overlapCount]);

  const ncommonPills = useMemo(() => {
    const list = ncommonQuery.data?.overlapInterests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .map((i) => getInterestLabel(i) || i)
      .filter(Boolean)
      .slice(0, 5);
  }, [ncommonQuery.data?.overlapInterests]);

  const title = useMemo(() => {
    if (!checkin) {
      return "Plan";
    }
    const label = getInterestLabel(checkin.interest) || checkin.interest;
    return label ? label : "Plan";
  }, [checkin]);

  const genderPref = useMemo(() => {
    const g = checkin?.desiredGender;
    if (!g) {
      return null;
    }
    if (g === "any") {
      return "Any";
    }
    if (g === "male") {
      return "Male";
    }
    if (g === "female") {
      return "Female";
    }
    return g;
  }, [checkin?.desiredGender]);

  const isMine = !!checkin?.isMine;

  const requestsList = useMemo(() => {
    const list = checkin?.requests;
    return Array.isArray(list) ? list : [];
  }, [checkin?.requests]);

  const pendingRequestsCount = useMemo(() => {
    return requestsList.filter((r) => r?.status === "pending").length;
  }, [requestsList]);

  const hasHighlightedRequest =
    typeof highlightRequestId === "number" && highlightRequestId > 0;

  // NEW: show the hint once, then auto-hide (so it doesn’t stick forever)
  useEffect(() => {
    if (!isMine || tabParam !== "requests") {
      setRequestsBannerVisible(false);
      return;
    }

    const key = `${planId || ""}:${highlightRequestId || ""}`;
    if (lastBannerKeyRef.current === key) {
      return;
    }
    lastBannerKeyRef.current = key;

    setRequestsBannerVisible(true);

    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }

    bannerTimeoutRef.current = setTimeout(() => {
      setRequestsBannerVisible(false);
    }, 8000);

    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
    };
  }, [highlightRequestId, isMine, planId, tabParam]);

  const showFullRequestsBanner = useMemo(() => {
    if (!isMine || tabParam !== "requests" || !requestsBannerVisible) {
      return false;
    }

    // Only show when it adds info:
    // - multiple pending requests, or
    // - no specific request highlighted (so user needs context)
    if (!hasHighlightedRequest) {
      return true;
    }
    return pendingRequestsCount > 1;
  }, [
    hasHighlightedRequest,
    isMine,
    pendingRequestsCount,
    requestsBannerVisible,
    tabParam,
  ]);

  const showMiniHighlightedBanner = useMemo(() => {
    if (!isMine || tabParam !== "requests" || !requestsBannerVisible) {
      return false;
    }
    return hasHighlightedRequest && pendingRequestsCount <= 1;
  }, [
    hasHighlightedRequest,
    isMine,
    pendingRequestsCount,
    requestsBannerVisible,
    tabParam,
  ]);

  const requestsBannerTitle = useMemo(() => {
    const n = pendingRequestsCount;
    const count = typeof n === "number" ? n : 0;
    return `Requests (${count})`;
  }, [pendingRequestsCount]);

  const requestsBannerSubtitle = useMemo(() => {
    return "Tap to review";
  }, []);

  const onScroll = useCallback(
    (e) => {
      if (!requestsBannerVisible) {
        return;
      }
      if (typeof requestsY !== "number") {
        return;
      }

      const y = e?.nativeEvent?.contentOffset?.y;
      if (typeof y !== "number") {
        return;
      }

      // Hide once the user scrolls back up past the requests area a bit.
      const hideThreshold = Math.max(0, requestsY - 140);
      if (y < hideThreshold) {
        setRequestsBannerVisible(false);
      }
    },
    [requestsBannerVisible, requestsY],
  );

  const showRequestsBanner = isMine && tabParam === "requests";
  const showHighlightedHint =
    showRequestsBanner && typeof highlightRequestId === "number";

  const mainError =
    uiError || (planQuery.error ? "Could not load this plan." : null);

  const headerName = checkin?.displayName || "Someone";
  const initials = initialsFromName(headerName);

  const requestStatus = checkin?.myRequest?.status || null;

  const primaryCtaTitle = useMemo(() => {
    if (isMine) {
      return null;
    }
    if (requestStatus === "pending") {
      return "Request sent";
    }
    if (requestStatus === "accepted") {
      return "Accepted";
    }
    if (requestStatus === "declined") {
      return "Declined";
    }
    if (requestStatus === "cancelled") {
      return "Cancelled";
    }
    // Make the action crystal-clear.
    return "Request to join";
  }, [isMine, requestStatus]);

  const primaryDisabled =
    requestMutation.isPending ||
    requestStatus === "pending" ||
    requestStatus === "accepted";

  const onOpenProfile = useCallback(() => {
    const id = checkin?.userId;
    if (!id) {
      return;
    }
    router.push(`/user/${id}`);
  }, [checkin?.userId, router]);

  const insightsQuery = usePlanInsights(planId, checkin, isMine);

  const onPressInsightsUpgrade = useCallback(() => {
    const n = insightsQuery.data?.upgradeNudge;
    if (n) {
      setUpgradePrompt(n);
      return;
    }
    setUpgradePrompt({
      title: "Upgrade",
      message: "Upgrade to unlock plan insights.",
      primaryCta: "Upgrade",
      secondaryCta: "Not now",
      target: "/upgrade",
      reason: "plan_insights_locked",
    });
  }, [insightsQuery.data?.upgradeNudge]);

  const onViewerPress = useCallback(
    (userId) => {
      router.push(`/user/${userId}`);
    },
    [router],
  );

  const myRequest = checkin?.myRequest || null;
  const myRequestStatus = myRequest?.status || null;
  const myConversationId = myRequest?.conversationId || null;

  const stickyCtaTitle = useMemo(() => {
    if (!checkin) {
      return null;
    }

    if (isMine) {
      if (pendingRequestsCount > 0) {
        return `View requests (${pendingRequestsCount})`;
      }
      return null;
    }

    if (!myRequestStatus) {
      return "Request to join";
    }

    if (myRequestStatus === "pending") {
      return "Requested";
    }

    if (myRequestStatus === "accepted") {
      return "Message host";
    }

    if (myRequestStatus === "declined" || myRequestStatus === "cancelled") {
      return "Not approved";
    }

    return "Request to join";
  }, [checkin, isMine, myRequestStatus, pendingRequestsCount]);

  const stickyCtaSubtitle = useMemo(() => {
    if (!checkin) {
      return null;
    }

    if (isMine) {
      return null;
    }

    if (myRequestStatus === "pending") {
      return "Waiting for approval";
    }

    return null;
  }, [checkin, isMine, myRequestStatus]);

  const showStickyCta = !!stickyCtaTitle;

  const stickyCtaDisabled = useMemo(() => {
    if (!checkin) {
      return true;
    }

    if (isMine) {
      return false;
    }

    if (requestMutation.isPending) {
      return true;
    }

    if (myRequestStatus === "pending") {
      return true;
    }

    if (myRequestStatus === "declined" || myRequestStatus === "cancelled") {
      return true;
    }

    return false;
  }, [checkin, isMine, myRequestStatus, requestMutation.isPending]);

  const stickyCtaStyle = useMemo(() => {
    const isPrimary =
      (isMine && pendingRequestsCount > 0) ||
      (!isMine && (!myRequestStatus || myRequestStatus === "accepted"));

    if (stickyCtaDisabled) {
      return {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      };
    }

    if (isPrimary) {
      return {
        backgroundColor: colors.primary,
      };
    }

    return {
      backgroundColor: colors.surfaceTint,
      borderWidth: 1,
      borderColor: colors.border,
    };
  }, [isMine, myRequestStatus, pendingRequestsCount, stickyCtaDisabled]);

  const stickyCtaTextColor = useMemo(() => {
    if (stickyCtaDisabled) {
      return colors.text;
    }
    const isPrimary =
      (isMine && pendingRequestsCount > 0) ||
      (!isMine && (!myRequestStatus || myRequestStatus === "accepted"));

    return isPrimary ? colors.primaryText : colors.text;
  }, [isMine, myRequestStatus, pendingRequestsCount, stickyCtaDisabled]);

  const onPressStickyCta = useCallback(() => {
    if (!checkin || stickyCtaDisabled) {
      return;
    }

    if (isMine) {
      // Route to the same plan with ?tab=requests so the banner + auto-scroll logic kicks in.
      router.replace({
        pathname: `/plans/${planId}`,
        params: { tab: "requests", focusNonce: String(Date.now()) },
      });
      return;
    }

    if (!myRequestStatus) {
      requestMutation.mutate();
      return;
    }

    if (myRequestStatus === "accepted") {
      const otherUserId = checkin?.userId;
      const otherName = checkin?.displayName || "Host";

      if (myConversationId) {
        router.push({
          pathname: `/messages/${myConversationId}`,
          params: {
            otherUserId: otherUserId ? String(otherUserId) : "",
            otherDisplayName: otherName,
            otherIsMinor: checkin?.isMinor ? "1" : "0",
            contextType: "plan",
            contextInterest: checkin?.interest ? String(checkin.interest) : "",
            contextLocationName: checkin?.locationName || "",
          },
        });
        return;
      }

      if (!otherUserId) {
        setUiError("Could not open chat.");
        return;
      }

      startConversationMutation.mutate(
        { targetUserId: otherUserId },
        {
          onSuccess: (data) => {
            const conversationId = data?.conversationId;
            if (!conversationId) {
              setUiError("Could not open chat.");
              return;
            }
            router.push({
              pathname: `/messages/${conversationId}`,
              params: {
                otherUserId: String(otherUserId),
                otherDisplayName: otherName,
              },
            });
          },
        },
      );
    }
  }, [
    checkin,
    isMine,
    myConversationId,
    myRequestStatus,
    planId,
    requestMutation,
    router,
    startConversationMutation,
    stickyCtaDisabled,
  ]);

  const hostUserId = !checkin?.isMine ? checkin?.userId : null;

  const blockHostMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: hostUserId }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/blocks, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateMany(queryClient, [
        ["blocks"],
        ["conversations"],
        ["notifications"],
        ["nearby"],
        ["ncommon"],
        ["stars"],
        ["checkins"],
        ["events"],
        ["mapPoints"],
      ]);

      Alert.alert("Blocked", "They won’t show up for you anymore.");
      router.back();
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not block", "Please try again.");
    },
  });

  const reportHostMutation = useMutation({
    mutationFn: async ({ reason }) => {
      const response = await authedFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: hostUserId,
          reason,
          details: "Reported from plan",
        }),
      });
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/reports, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: () => {
      Alert.alert(
        "Reported",
        "Thanks — we'll review this. If you're in danger, call 911.",
      );
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not report", "Please try again.");
    },
  });

  const onMore = useCallback(() => {
    if (!hostUserId) {
      return;
    }

    Alert.alert("Options", "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "View profile",
        onPress: () => {
          router.push(`/user/${hostUserId}`);
        },
      },
      {
        text: "Report host",
        onPress: () => {
          Alert.alert("Report", "Pick a reason", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Solicitation",
              style: "destructive",
              onPress: () =>
                reportHostMutation.mutate({ reason: "solicitation" }),
            },
            {
              text: "Harassment",
              style: "destructive",
              onPress: () =>
                reportHostMutation.mutate({ reason: "harassment" }),
            },
            {
              text: "Other",
              style: "destructive",
              onPress: () => reportHostMutation.mutate({ reason: "other" }),
            },
          ]);
        },
      },
      {
        text: "Block host",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Block this user?",
            "They will disappear from your map and lists, and messaging will be blocked.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => blockHostMutation.mutate(),
              },
            ],
          );
        },
      },
    ]);
  }, [blockHostMutation, hostUserId, reportHostMutation, router]);

  if (!planId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          Invalid plan
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
            textAlign: "center",
          }}
        >
          This link doesn’t look right.
        </Text>
        <TouchableOpacity
          onPress={() => safeBack(router, "/")}
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
          <Text style={{ fontWeight: "900", color: colors.text }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // NEW: account for sticky CTA height so it doesn't cover content.
  const scrollBottomPadding = insets.bottom + 28 + (showStickyCta ? 86 : 0);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: scrollBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PlanHeader
          title={title}
          onBack={() => safeBack(router, "/")}
          onMore={!isMine ? onMore : undefined}
        />

        <ErrorMessage message={mainError} />

        {planQuery.isLoading ? (
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        ) : planQuery.data?.upgradeNudge ? (
          <UpgradePrompt
            message={planQuery.data?.upgradeNudge?.message}
            onUpgrade={() => router.push("/upgrade")}
          />
        ) : checkin ? (
          <View style={{ marginTop: 14, gap: 12 }}>
            <PlanCard
              checkin={checkin}
              initials={initials}
              genderPref={genderPref}
              isMine={isMine}
              primaryCtaTitle={""}
              primaryDisabled={true}
              onOpenProfile={onOpenProfile}
              onRequest={() => {}}
              isRequesting={false}
              showInlineCta={false}
            />

            {/* NEW: nCommon preview (for non-host viewers) */}
            {!isMine ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 18,
                  padding: 14,
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
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Sparkles size={16} color={colors.primary} />
                    <Text style={{ fontWeight: "900", color: colors.text }}>
                      nCommon
                    </Text>
                  </View>

                  {ncommonQuery.isLoading ? (
                    <ActivityIndicator size="small" />
                  ) : typeof ncommonCount === "number" ? (
                    <Text style={{ fontWeight: "900", color: colors.primary }}>
                      {ncommonCount} in common
                    </Text>
                  ) : null}
                </View>

                {!ncommonQuery.isLoading && ncommonPills.length ? (
                  <View
                    style={{
                      marginTop: 10,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {ncommonPills.map((label) => (
                      <Pill key={label} text={label} />
                    ))}
                  </View>
                ) : null}

                {!ncommonQuery.isLoading && !ncommonPills.length ? (
                  <Text
                    style={{
                      marginTop: 10,
                      color: colors.subtext,
                      fontWeight: "700",
                      lineHeight: 18,
                    }}
                  >
                    Add a few interests to get better matches.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isMine ? (
              <PlanInsights
                insightsQuery={insightsQuery}
                onPressInsightsUpgrade={onPressInsightsUpgrade}
                onViewerPress={onViewerPress}
              />
            ) : null}

            {isMine ? (
              <View
                onLayout={(e) => {
                  const y = e?.nativeEvent?.layout?.y;
                  if (typeof y === "number") {
                    setRequestsY(y);
                  }
                }}
              >
                {showFullRequestsBanner ? (
                  <View
                    style={{
                      marginBottom: 10,
                      backgroundColor: "rgba(47,128,237,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(47,128,237,0.22)",
                      borderRadius: 16,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
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
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                        }}
                      >
                        <Inbox size={16} color={colors.primary} />
                        <Text
                          style={{
                            fontWeight: "900",
                            color: colors.text,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {requestsBannerTitle}
                        </Text>
                      </View>

                      {hasHighlightedRequest ? (
                        <Text
                          style={{
                            fontWeight: "900",
                            fontSize: 12,
                            color: colors.primary,
                          }}
                        >
                          New request highlighted
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={{
                        marginTop: 4,
                        color: colors.subtext,
                        fontWeight: "800",
                        lineHeight: 18,
                      }}
                    >
                      {requestsBannerSubtitle}
                    </Text>
                  </View>
                ) : null}

                {showMiniHighlightedBanner ? (
                  <View
                    style={{
                      marginBottom: 10,
                      backgroundColor: "rgba(47,128,237,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(47,128,237,0.22)",
                      borderRadius: 16,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Inbox size={16} color={colors.primary} />
                    <Text style={{ fontWeight: "900", color: colors.text }}>
                      New request highlighted
                    </Text>
                  </View>
                ) : null}

                {/* Host: end plan early and trigger meetup confirmation */}
                {isMine && meetupAttendees.length > 0 ? (
                  <TouchableOpacity
                    onPress={onEndPlanEarly}
                    style={{
                      marginBottom: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      backgroundColor: colors.surfaceElevated,
                      borderRadius: radii.button,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                      End plan early & confirm meetups
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <PlanRequests
                  requests={requestsList}
                  highlightRequestId={highlightRequestId}
                  onRespond={(p) => respondMutation.mutate(p)}
                  isResponding={respondMutation.isPending}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {showStickyCta ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(14, insets.bottom + 10),
            backgroundColor: "rgba(255,255,255,0.98)",
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {stickyCtaSubtitle ? (
            <Text
              style={{
                marginBottom: 8,
                color: colors.subtext,
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              {stickyCtaSubtitle}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={onPressStickyCta}
            disabled={stickyCtaDisabled}
            style={{
              borderRadius: radii.button,
              paddingVertical: 14,
              alignItems: "center",
              opacity: stickyCtaDisabled ? 0.7 : 1,
              ...stickyCtaStyle,
              ...(stickyCtaStyle.borderWidth
                ? { borderWidth: stickyCtaStyle.borderWidth }
                : null),
              ...(stickyCtaStyle.borderColor
                ? { borderColor: stickyCtaStyle.borderColor }
                : null),
            }}
          >
            <Text
              style={{
                color: stickyCtaTextColor,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {requestMutation.isPending ? "Sending…" : stickyCtaTitle}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ConfirmMeetupModal
        visible={meetupModalVisible}
        onClose={() => setMeetupModalVisible(false)}
        checkinId={planId}
        attendees={meetupAttendees}
        planInterest={checkin?.interest ? (getInterestLabel(checkin.interest) || checkin.interest) : undefined}
        planLocation={checkin?.locationName}
      />

      <UpgradePromptModal
        visible={!!upgradePrompt}
        title={upgradePrompt?.title}
        message={upgradePrompt?.message}
        primaryText={upgradePrompt?.primaryCta || "Upgrade"}
        secondaryText={upgradePrompt?.secondaryCta || "Not now"}
        onPrimary={() => {
          const target = upgradePrompt?.target || "/upgrade";
          setUpgradePrompt(null);
          router.push(target);
        }}
        onClose={() => setUpgradePrompt(null)}
      />
    </View>
  );
}
