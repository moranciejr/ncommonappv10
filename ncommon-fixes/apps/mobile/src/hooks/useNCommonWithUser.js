import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function useNCommonWithUser(targetUserId) {
  const safeId =
    typeof targetUserId === "number"
      ? targetUserId
      : parseInt(String(targetUserId || ""), 10);

  return useQuery({
    queryKey: ["ncommonUser", { targetUserId: safeId || null }],
    enabled: Number.isFinite(safeId) && safeId > 0,
    queryFn: async ({ signal } = {}) => {
      const url = `/api/users/${safeId}/ncommon`;
      const response = await authedFetch(url, { signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching ${url}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    staleTime: 60 * 1000,
  });
}
