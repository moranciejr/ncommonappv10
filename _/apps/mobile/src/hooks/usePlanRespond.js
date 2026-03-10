import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

function nextStatusFromAction(action) {
  if (action === "accept") {
    return "accepted";
  }
  if (action === "decline") {
    return "declined";
  }
  if (action === "cancel") {
    return "cancelled";
  }
  return null;
}

export function usePlanRespond(planId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, action }) => {
      const response = await authedFetch(
        `/api/checkins/requests/${requestId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/checkins/requests/${requestId}/respond, the response was [${response.status}] ${msg}`,
        );
      }
      return { ...data, requestId, action };
    },

    // NEW: optimistic update so the Requests list updates instantly.
    onMutate: async ({ requestId, action }) => {
      const nextStatus = nextStatusFromAction(action);
      if (!nextStatus) {
        return {};
      }

      await queryClient.cancelQueries({
        queryKey: ["checkin", { id: planId }],
      });

      const previous = queryClient.getQueryData(["checkin", { id: planId }]);

      queryClient.setQueryData(["checkin", { id: planId }], (old) => {
        const oldCheckin = old?.checkin;
        if (!oldCheckin) {
          return old;
        }

        const oldRequests = Array.isArray(oldCheckin.requests)
          ? oldCheckin.requests
          : [];

        const nextRequests = oldRequests.map((r) => {
          if (r?.id !== requestId) {
            return r;
          }
          return { ...r, status: nextStatus };
        });

        const myRequestId = oldCheckin?.myRequest?.id;
        const nextMyRequest =
          myRequestId === requestId
            ? { ...oldCheckin.myRequest, status: nextStatus }
            : oldCheckin.myRequest;

        return {
          ...(old || {}),
          checkin: {
            ...oldCheckin,
            requests: nextRequests,
            myRequest: nextMyRequest,
          },
        };
      });

      return { previous };
    },

    onSuccess: async () => {
      // Refresh everything that can show request status.
      await queryClient.invalidateQueries({
        queryKey: ["checkin", { id: planId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },

    onError: (err, _vars, ctx) => {
      console.error(err);
      if (ctx?.previous) {
        queryClient.setQueryData(["checkin", { id: planId }], ctx.previous);
      }
      Alert.alert("Could not update", "Please try again.");
    },
  });
}
