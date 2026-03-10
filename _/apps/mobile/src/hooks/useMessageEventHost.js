import { useCallback } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

export function useMessageEventHost({ currentUserId, setUpgradePrompt }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const messageEventHostMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          err.status = 403;
          throw err;
        }

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
    onSuccess: async (data, variables) => {
      // Make sure the new chat shows up immediately in the Messages tab.
      try {
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch (err) {
        console.error(err);
      }

      const conversationId = data?.conversationId;
      const otherUserId = variables?.targetUserId;

      if (!conversationId || !otherUserId) {
        return;
      }

      const eventTitle =
        typeof variables?.eventTitle === "string"
          ? variables.eventTitle
          : "meetup";
      const interestLabel =
        typeof variables?.interestLabel === "string"
          ? variables.interestLabel
          : null;

      const starterMessage = interestLabel
        ? `Hey! Your ${eventTitle} (${interestLabel}) looks fun — is it still open to more people?`
        : `Hey! Your ${eventTitle} looks fun — is it still open to more people?`;

      router.push({
        pathname: `/messages/${conversationId}`,
        params: {
          otherUserId: String(otherUserId),
          otherDisplayName: "Host",
          otherIsMinor: "0",
          starterMessage,
          contextType: "event",
          contextInterest: variables?.interestValue
            ? String(variables.interestValue)
            : "",
          contextEventTitle: eventTitle,
          contextLocationName:
            typeof variables?.locationName === "string"
              ? variables.locationName
              : "",
        },
      });
    },
    onError: (err) => {
      console.error(err);
      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        if (nudge) {
          setUpgradePrompt(nudge);
          return;
        }
      }

      if (err?.status === 403) {
        Alert.alert("Can't message", err?.userMessage || "Not allowed.");
        return;
      }

      Alert.alert("Could not start chat", "Please try again.");
    },
  });

  const onMessageEventHost = useCallback(
    (e) => {
      const targetUserId = e?.creatorUserId;
      if (!targetUserId || messageEventHostMutation.isPending) {
        return;
      }
      if (typeof currentUserId === "number" && targetUserId === currentUserId) {
        return;
      }

      const safeTitle =
        typeof e?.title === "string" && e.title.trim()
          ? e.title.trim()
          : "meetup";
      const interestLabel = e?.interest
        ? getInterestLabel(e.interest) || e.interest
        : null;

      messageEventHostMutation.mutate({
        targetUserId,
        eventTitle: safeTitle,
        interestLabel,
        interestValue: e?.interest || "",
        locationName: e?.locationName || "",
      });
    },
    [currentUserId, messageEventHostMutation],
  );

  return {
    messageEventHostMutation,
    onMessageEventHost,
  };
}
