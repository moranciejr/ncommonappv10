import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

// Plan join request. Screen decides what to do after success.
export function usePlanRequest(planId, setUiError, onNudge, onSuccessData) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
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
        throw new Error(
          `When fetching /api/checkins/${planId}/request, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },

    // NEW: optimistic update so the button flips to "Request sent" instantly.
    onMutate: async () => {
      setUiError(null);

      await queryClient.cancelQueries({
        queryKey: ["checkin", { id: planId }],
      });

      const previous = queryClient.getQueryData(["checkin", { id: planId }]);

      queryClient.setQueryData(["checkin", { id: planId }], (old) => {
        const oldCheckin = old?.checkin;
        if (!oldCheckin) {
          return old;
        }

        const currentStatus = oldCheckin?.myRequest?.status;
        if (currentStatus === "pending" || currentStatus === "accepted") {
          return old;
        }

        return {
          ...(old || {}),
          checkin: {
            ...oldCheckin,
            myRequest: {
              id: oldCheckin?.myRequest?.id || "optimistic",
              status: "pending",
            },
          },
        };
      });

      return { previous };
    },

    onSuccess: async (data) => {
      // State machine: requesting does NOT auto-open chat.
      Alert.alert("Requested", "Waiting for approval.");
      onSuccessData?.(data);

      // Make sure all the places this status can show up are refreshed.
      await queryClient.invalidateQueries({
        queryKey: ["checkin", { id: planId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
    },

    onError: (err, _vars, ctx) => {
      console.error(err);

      // Roll back optimistic change.
      if (ctx?.previous) {
        queryClient.setQueryData(["checkin", { id: planId }], ctx.previous);
      }

      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        if (nudge) {
          onNudge?.(nudge);
          return;
        }
        onNudge?.({
          title: "Verify your email",
          message: "Please verify your email to request to join plans.",
          primaryCta: "Verify email",
          secondaryCta: "Not now",
          target: "/verify-email",
          reason: "email_verify_required_request_plan",
        });
        return;
      }
      setUiError("Could not send request.");
    },
  });
}
