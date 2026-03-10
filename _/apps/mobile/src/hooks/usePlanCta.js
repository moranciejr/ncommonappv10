import { useCallback } from "react";
import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

// Shared CTA state machine for plans (checkins) used across list cards and map sheet.
// Depends on requestJoinMutation from useRequestJoin.
export function usePlanCta({ requestJoinMutation, onChatOpenError }) {
  const router = useRouter();

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
        const err = new Error(
          `When fetching /api/messages/conversations, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }
      return data;
    },
    onError: (err) => {
      console.error(err);
      const message =
        typeof onChatOpenError === "function"
          ? "Could not open chat."
          : err?.userMessage || "Could not open chat.";

      if (typeof onChatOpenError === "function") {
        onChatOpenError(message);
        return;
      }

      Alert.alert("Could not open chat", message);
    },
  });

  const openChatForPlan = useCallback(
    (checkin) => {
      const conversationId = checkin?.myRequest?.conversationId;
      const hostUserId = checkin?.userId;
      const hostName = checkin?.displayName || "Host";

      if (conversationId) {
        router.push({
          pathname: `/messages/${conversationId}`,
          params: {
            otherUserId: hostUserId ? String(hostUserId) : "",
            otherDisplayName: hostName,
          },
        });
        return;
      }

      if (!hostUserId) {
        if (typeof onChatOpenError === "function") {
          onChatOpenError("Could not open chat.");
          return;
        }
        Alert.alert("Could not open chat", "Please try again.");
        return;
      }

      startConversationMutation.mutate(
        { targetUserId: hostUserId },
        {
          onSuccess: (data) => {
            const id = data?.conversationId;
            if (!id) {
              if (typeof onChatOpenError === "function") {
                onChatOpenError("Could not open chat.");
                return;
              }
              Alert.alert("Could not open chat", "Please try again.");
              return;
            }

            router.push({
              pathname: `/messages/${id}`,
              params: {
                otherUserId: String(hostUserId),
                otherDisplayName: hostName,
              },
            });
          },
        },
      );
    },
    [onChatOpenError, router, startConversationMutation],
  );

  const requestPlanJoin = useCallback(
    (checkin) => {
      const planId = checkin?.id;
      if (!planId || requestJoinMutation?.isPending) {
        return;
      }
      requestJoinMutation.mutate({ planId });
    },
    [requestJoinMutation],
  );

  const getCtaForPlan = useCallback(
    (checkin) => {
      if (!checkin?.id) {
        return null;
      }

      const isMine = !!checkin?.isMine;
      const pendingCount =
        typeof checkin?.pendingRequestCount === "number"
          ? checkin.pendingRequestCount
          : 0;

      if (isMine) {
        if (pendingCount <= 0) {
          return null;
        }

        return {
          title: `View requests (${pendingCount})`,
          disabled: false,
          onPress: () =>
            router.push({
              pathname: `/plans/${checkin.id}`,
              params: { tab: "requests", focusNonce: String(Date.now()) },
            }),
        };
      }

      const status = checkin?.myRequest?.status || null;

      const pendingPlanId = requestJoinMutation?.variables?.planId;
      const isRequestingThis =
        requestJoinMutation?.isPending && pendingPlanId === checkin.id;

      if (!status) {
        return {
          title: "Request to join",
          disabled: !!isRequestingThis,
          onPress: () => requestPlanJoin(checkin),
        };
      }

      if (status === "pending") {
        return { title: "Requested", disabled: true, onPress: () => {} };
      }

      if (status === "accepted") {
        return {
          title: "Message host",
          disabled: false,
          onPress: () => openChatForPlan(checkin),
        };
      }

      if (status === "declined" || status === "cancelled") {
        return { title: "Not approved", disabled: true, onPress: () => {} };
      }

      return { title: "Request to join", disabled: false, onPress: () => {} };
    },
    [
      openChatForPlan,
      requestJoinMutation?.isPending,
      requestJoinMutation?.variables?.planId,
      requestPlanJoin,
      router,
    ],
  );

  return {
    getCtaForPlan,
    openChatForPlan,
  };
}
