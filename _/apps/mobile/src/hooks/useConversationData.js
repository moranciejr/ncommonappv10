import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { parseId } from "@/utils/conversationUtils";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

export function useConversationData(conversationId) {
  const messagesQuery = useQuery({
    queryKey: ["conversation", { conversationId }],
    enabled: !!conversationId,
    queryFn: async () => {
      const response = await authedFetch(
        `/api/messages/conversations/${conversationId}`,
      );
      const data = await readResponseBody(response);
      if (!response.ok) {
        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/messages/conversations/${conversationId}, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }
      return data;
    },
  });

  const otherUserFromApi = useMemo(() => {
    const u = messagesQuery.data?.otherUser;
    return u && typeof u === "object" ? u : null;
  }, [messagesQuery.data?.otherUser]);

  const otherUserIdEffective = useMemo(() => {
    const apiId = parseId(messagesQuery.data?.otherUserId);
    const apiId2 = parseId(otherUserFromApi?.id);
    return apiId || apiId2;
  }, [otherUserFromApi?.id, messagesQuery.data?.otherUserId]);

  const messages = useMemo(() => {
    const list = messagesQuery.data?.messages;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [messagesQuery.data?.messages]);

  return {
    messagesQuery,
    otherUserFromApi,
    otherUserIdEffective,
    messages,
  };
}
