import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import authedFetch from "@/utils/authedFetch";
import { invalidateMany } from "@/utils/retryQueries";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";
import { trackEvent } from "@/utils/analytics";

export function useConversationActions({
  conversationId,
  currentUserId,
  otherUserIdEffective,
  otherName,
  onSendFailed,
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState(null);

  const sendMutation = useMutation({
    mutationFn: async ({ text }) => {
      const response = await authedFetch(
        `/api/messages/conversations/${conversationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );

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
          `When fetching /api/messages/conversations/${conversationId}, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }

      return data;
    },
    onMutate: async ({ text, clientId }) => {
      setError(null);
      setPrompt(null);

      await queryClient.cancelQueries({
        queryKey: ["conversation", { conversationId }],
      });

      const previous = queryClient.getQueryData([
        "conversation",
        { conversationId },
      ]);

      const optimistic = {
        id: clientId || `optimistic-${Date.now()}`,
        sender_user_id: currentUserId || -1,
        body: text,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(["conversation", { conversationId }], (old) => {
        const oldList = Array.isArray(old?.messages) ? old.messages : [];
        return { ...old, messages: [...oldList, optimistic] };
      });

      return { previous, optimisticId: optimistic.id, optimisticText: text };
    },
    onSuccess: (data, variables, ctx) => {
      const serverMessage = data?.message;
      const serverId = serverMessage?.id;

      if (!ctx?.optimisticId || !serverId) {
        return;
      }

      const nextMessage = {
        id: serverId,
        sender_user_id: currentUserId || -1,
        body: variables?.text || ctx.optimisticText || "",
        created_at: serverMessage?.created_at || new Date().toISOString(),
      };

      queryClient.setQueryData(["conversation", { conversationId }], (old) => {
        const oldList = Array.isArray(old?.messages) ? old.messages : [];
        const nextList = oldList.map((m) => {
          if (String(m?.id) !== String(ctx.optimisticId)) {
            return m;
          }
          return nextMessage;
        });
        return { ...(old || {}), messages: nextList };
      });

      // Fire-and-forget funnel analytics.
      trackEvent("message_sent", {
        conversationId,
        otherUserId: otherUserIdEffective || null,
      }).catch(() => null);
    },
    onError: (err, vars, ctx) => {
      console.error(err);
      if (ctx?.previous) {
        queryClient.setQueryData(
          ["conversation", { conversationId }],
          ctx.previous,
        );
      }

      // Restore the draft so the user can retry (network drop, etc.)
      try {
        if (typeof onSendFailed === "function") {
          onSendFailed(vars?.text, err);
        }
      } catch (e) {
        console.error(e);
      }

      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        setPrompt(
          nudge || {
            title: "Verify your email",
            message: "Please verify your email to send messages.",
            primaryCta: "Verify email",
            secondaryCta: "Not now",
            target: "/verify-email",
            reason: "email_verify_required_send_message",
          },
        );
        setError(null);
        return;
      }

      const msg = err?.userMessage || "Could not send message.";
      setError(msg);

      if (err?.status === 403) {
        Alert.alert("Messaging restricted", msg);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["conversation", { conversationId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: otherUserIdEffective }),
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
      Alert.alert("Blocked", "They won't be able to message you.");
      router.back();
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not block", "Please try again.");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ reason, details }) => {
      const response = await authedFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: otherUserIdEffective,
          reason,
          details,
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
    if (!otherUserIdEffective) {
      Alert.alert(
        "Missing user",
        "Could not find the other person for this chat.",
      );
      return;
    }

    Alert.alert(otherName, "Choose an action", [
      {
        text: "Report",
        style: "default",
        onPress: () => {
          Alert.alert("Report user", "What's the issue?", [
            {
              text: "Solicitation / inappropriate",
              onPress: () =>
                reportMutation.mutate({
                  reason: "solicitation",
                  details: "Reported from chat",
                }),
            },
            {
              text: "Harassment",
              onPress: () =>
                reportMutation.mutate({
                  reason: "harassment",
                  details: "Reported from chat",
                }),
            },
            {
              text: "Other",
              onPress: () =>
                reportMutation.mutate({
                  reason: "other",
                  details: "Reported from chat",
                }),
            },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            `Block ${otherName}?`,
            "They will disappear from your map and lists, and messaging will be blocked.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => blockMutation.mutate(),
              },
            ],
          ),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [blockMutation, otherName, otherUserIdEffective, reportMutation]);

  return {
    sendMutation,
    blockMutation,
    reportMutation,
    onMore,
    error,
    setError,
    prompt,
    setPrompt,
  };
}
