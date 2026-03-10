import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

/**
 * useMeetups
 *
 * Fetches GET /api/users/[id]/meetups — the mutual meetup list for a profile.
 * Only shows people where both parties confirmed.
 */
export function useMeetups({ userId } = {}) {
  const meetupsQuery = useQuery({
    queryKey: ["meetups", { userId }],
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 min — meetup lists change infrequently
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch(
        `/api/users/${userId}/meetups`,
        { signal },
      );
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(msg);
        err.status = response.status;
        throw err;
      }
      return data;
    },
  });

  return {
    meetupsQuery,
    meetups: meetupsQuery.data?.meetups || [],
    total: meetupsQuery.data?.total || 0,
  };
}
