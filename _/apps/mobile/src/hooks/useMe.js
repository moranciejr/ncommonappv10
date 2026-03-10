import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/utils/auth/useAuth";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

export function useMe() {
  const { isReady, isAuthenticated, auth } = useAuth();

  const hasJwt = !!auth?.jwt;

  const meQuery = useQuery({
    queryKey: ["me"],
    enabled: !!isReady && !!isAuthenticated && hasJwt,
    queryFn: async () => {
      const response = await authedFetch("/api/me");
      const data = await readResponseBody(response);

      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/me, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }

      return data;
    },
    staleTime: 15000,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  return { meQuery };
}

export default useMe;
