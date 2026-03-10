import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { parseDobToISODate, clampText } from "@/utils/dateValidation";
import authedFetch from "@/utils/authedFetch";
import { trackEvent } from "@/utils/analytics";

export function useOnboardingCompletion({
  displayName,
  bio,
  city,
  stateName,
  avatarUrl,
  interests,
  dobText,
  showAge,
  setError,
  onDone,
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const completeMutation = useMutation({
    mutationFn: async () => {
      const dobParsed = parseDobToISODate(dobText);
      if (!dobParsed.iso) {
        throw new Error(dobParsed.error || "Date of birth is required");
      }

      const payload = {
        displayName: clampText(displayName.trim(), 80),
        bio: clampText(bio.trim(), 500),
        city: clampText(city.trim(), 120),
        state: clampText(stateName.trim(), 120),
        avatarUrl: clampText(avatarUrl.trim(), 2000),
        interests,
        dateOfBirth: dobParsed.iso,
        showAge: !!showAge,
      };

      const response = await authedFetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/onboarding/complete, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["onboardingStatus"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      setError(null);

      // Fire-and-forget analytics.
      trackEvent("onboarding_complete", {}).catch(() => null);

      if (typeof onDone === "function") {
        try {
          onDone();
        } catch (err) {
          console.error(err);
        }
      }

      // Route groups like (tabs) are not part of the URL. Use /map.
      router.replace("/map");
    },
    onError: (err) => {
      console.error(err);
      const msg =
        typeof err?.message === "string" && err.message
          ? err.message
          : "Could not finish onboarding. Please double-check your info and try again.";
      setError(msg);
    },
  });

  return completeMutation;
}
