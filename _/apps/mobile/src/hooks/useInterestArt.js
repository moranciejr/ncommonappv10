import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

const INTEREST_ART_VERSION = "2";

export function useInterestArt() {
  return useQuery({
    queryKey: ["interestArt", INTEREST_ART_VERSION],
    queryFn: async () => {
      // First run may generate images and can take longer than a normal API call.
      const response = await authedFetch(
        `/api/interest-art?v=${INTEREST_ART_VERSION}`,
        {
          timeoutMs: 120000,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/interest-art, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h (backend already caches, this avoids noisy refetching)
    retry: 1,
  });
}
