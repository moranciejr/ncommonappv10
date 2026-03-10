import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

export function usePlanQuery(planId) {
  return useQuery({
    queryKey: ["checkin", { id: planId }],
    enabled: !!planId,
    staleTime: 1000 * 15, // 15s — plan detail (requests/status can change)
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch(`/api/checkins/${planId}`);
      const data = await readResponseBody(response);

      if (response.status === 402) {
        return {
          ok: false,
          checkin: null,
          usage: data?.usage || null,
          upgradeNudge: data?.upgradeNudge || null,
        };
      }

      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/checkins/${planId}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });
}
