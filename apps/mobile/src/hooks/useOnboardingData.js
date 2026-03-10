import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function useOnboardingData(initialOnboarding) {
  const onboardingQuery = useQuery({
    queryKey: ["onboardingStatus"],
    enabled: !initialOnboarding,
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch("/api/onboarding/status", { signal }, {
        method: "GET",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/onboarding/status, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const initialOnboardingResolved =
    initialOnboarding || onboardingQuery.data?.onboarding;

  return {
    initialOnboardingResolved,
    isLoading: onboardingQuery.isLoading,
  };
}
