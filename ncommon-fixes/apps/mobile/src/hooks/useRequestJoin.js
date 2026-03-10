import { useCallback } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { trackEvent } from "@/utils/analytics";

export function useRequestJoin({ setUpgradePrompt }) {
  const queryClient = useQueryClient();

  const requestJoinMutation = useMutation({
    mutationFn: async ({ planId }) => {
      const response = await authedFetch(`/api/checkins/${planId}/request`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          throw err;
        }

        const msg = data?.error || response.statusText;
        const err = new Error(
          `When fetching /api/checkins/${planId}/request, the response was [${response.status}] ${msg}`,
        );
        err.userMessage = msg;
        err.status = response.status;
        throw err;
      }

      return { data, planId };
    },

    // NEW: optimistic update so card CTA flips to "Requested" instantly.
    onMutate: async ({ planId }) => {
      await queryClient.cancelQueries({ queryKey: ["checkins"] });
      await queryClient.cancelQueries({ queryKey: ["mapPoints"] });

      const previousCheckins = queryClient.getQueryData(["checkins"]);
      // mapPoints is keyed with params, so snapshot all matching queries.
      const previousMapPointsEntries = queryClient.getQueriesData({
        queryKey: ["mapPoints"],
      });

      queryClient.setQueryData(["checkins"], (old) => {
        const list = old?.checkins;
        if (!Array.isArray(list)) {
          return old;
        }

        const next = list.map((c) => {
          if (c?.id !== planId) {
            return c;
          }

          const status = c?.myRequest?.status;
          if (status === "pending" || status === "accepted") {
            return c;
          }

          return {
            ...c,
            myRequest: {
              id: c?.myRequest?.id || "optimistic",
              status: "pending",
              conversationId: c?.myRequest?.conversationId || null,
            },
          };
        });

        return { ...(old || {}), checkins: next };
      });

      // Also update mapPoints so the map sheet / markers can reflect the same CTA immediately.
      queryClient.setQueriesData({ queryKey: ["mapPoints"] }, (old) => {
        const list = old?.users;
        if (!Array.isArray(list)) {
          return old;
        }

        const next = list.map((u) => {
          if (u?.id !== planId) {
            return u;
          }

          const status = u?.myRequest?.status;
          if (status === "pending" || status === "accepted") {
            return u;
          }

          return {
            ...u,
            myRequest: {
              id: u?.myRequest?.id || "optimistic",
              status: "pending",
              conversationId: u?.myRequest?.conversationId || null,
            },
          };
        });

        return { ...(old || {}), users: next };
      });

      return { previousCheckins, previousMapPointsEntries };
    },

    onSuccess: async ({ planId }) => {
      // Keep the UI in sync everywhere a plan card can render.
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({
        queryKey: ["checkin", { id: planId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });

      // Fire-and-forget funnel analytics.
      trackEvent("plan_request_sent", { checkinId: planId }).catch(() => null);

      // State machine: requesting does NOT auto-open chat.
      Alert.alert("Requested", "Waiting for approval.");
    },

    onError: (err, _vars, ctx) => {
      console.error(err);

      // Roll back optimistic change.
      if (ctx?.previousCheckins) {
        queryClient.setQueryData(["checkins"], ctx.previousCheckins);
      }
      if (Array.isArray(ctx?.previousMapPointsEntries)) {
        for (const [key, data] of ctx.previousMapPointsEntries) {
          try {
            queryClient.setQueryData(key, data);
          } catch (e) {
            console.error(e);
          }
        }
      }

      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        if (nudge) {
          setUpgradePrompt(nudge);
          return;
        }
      }
      Alert.alert("Could not request", err?.userMessage || "Please try again.");
    },
  });

  const onRequestJoinFromMap = useCallback(
    (u) => {
      if (!u?.id || requestJoinMutation.isPending) {
        return;
      }
      requestJoinMutation.mutate({
        planId: u.id,
      });
    },
    [requestJoinMutation],
  );

  return {
    requestJoinMutation,
    onRequestJoinFromMap,
  };
}
