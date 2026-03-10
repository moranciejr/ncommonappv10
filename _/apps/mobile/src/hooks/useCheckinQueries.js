import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function useCheckinQueries() {
  const onboardingQuery = useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: async () => {
      const response = await authedFetch("/api/onboarding/status");
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

  const checkinsQuery = useQuery({
    queryKey: ["checkins"],
    queryFn: async () => {
      const response = await authedFetch("/api/checkins");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/checkins, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const profileSettingsQuery = useQuery({
    queryKey: ["profileSettings"],
    queryFn: async () => {
      const response = await authedFetch("/api/profile/settings");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/profile/settings, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 1000 * 30,
  });

  return {
    onboardingQuery,
    checkinsQuery,
    profileSettingsQuery,
  };
}
