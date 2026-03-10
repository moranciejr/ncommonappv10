import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function usePlanInsights(planId, checkin, isMine) {
  return useQuery({
    queryKey: ["checkinInsights", { id: planId }],
    enabled: !!planId && !!checkin && isMine,
    queryFn: async () => {
      const response = await authedFetch(`/api/checkins/${planId}/insights`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/checkins/${planId}/insights, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 1000 * 20,
  });
}
