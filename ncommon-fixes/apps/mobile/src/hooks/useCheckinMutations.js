import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { clampText } from "@/utils/textUtils";
import { trackEvent } from "@/utils/analytics";

export function useCheckinMutations({
  locationName,
  note,
  selectedInterest,
  desiredGroupSize,
  desiredGender,
  placeCoords,
  deviceCoords,
  placeId,
  placeAddress,
  defaultExpiresMinutes,
  startOffsetMinutes,
  onCreateSuccess,
  onCreateError,
  onEndSuccess,
  onEndError,
}) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const coordsToUse = placeCoords || deviceCoords;

      const offset =
        typeof startOffsetMinutes === "number" &&
        Number.isFinite(startOffsetMinutes)
          ? Math.max(0, Math.min(24 * 60, Math.round(startOffsetMinutes)))
          : 0;

      const startsAt = new Date(Date.now() + offset * 60 * 1000).toISOString();

      const payload = {
        locationName: clampText(locationName.trim(), 160),
        note: clampText(note.trim(), 280),
        startsAt,
        expiresInMinutes: defaultExpiresMinutes,
        interest: selectedInterest || "",
        desiredGroupSize: desiredGroupSize || null,
        desiredGender: desiredGender || null,
        lat: coordsToUse?.lat ?? null,
        lng: coordsToUse?.lng ?? null,
        placeId: placeId || null,
        placeAddress: clampText(placeAddress || "", 255),
      };

      const response = await authedFetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Special case: verify email gate
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          throw err;
        }

        // Special case: paywall / upgrade prompt
        if (response.status === 402 && data?.upgradeNudge) {
          const err = new Error(data?.error || "Upgrade required");
          err.code = "UPGRADE_REQUIRED";
          err.payload = data;
          throw err;
        }

        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/checkins, the response was [${response.status}] ${msg}`,
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });

      // Fire-and-forget funnel analytics.
      trackEvent("plan_created", { checkinId: data?.id || null }).catch(
        () => null,
      );

      if (onCreateSuccess) {
        onCreateSuccess(data);
      }
    },
    onError: (err) => {
      console.error(err);
      if (onCreateError) {
        onCreateError(err);
      }
    },
  });

  const endMutation = useMutation({
    mutationFn: async (id) => {
      const response = await authedFetch(`/api/checkins/${id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/checkins/${id}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (onEndSuccess) {
        onEndSuccess();
      }
    },
    onError: (err) => {
      console.error(err);
      if (onEndError) {
        onEndError(err);
      }
    },
  });

  return {
    createMutation,
    endMutation,
  };
}
