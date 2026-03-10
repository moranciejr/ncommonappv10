import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { parseId } from "@/utils/conversationUtils";

export function useConversationParams() {
  const params = useLocalSearchParams();

  const conversationId = useMemo(() => parseId(params?.id), [params?.id]);
  const otherUserId = useMemo(
    () => parseId(params?.otherUserId),
    [params?.otherUserId],
  );

  const otherNameFromParams =
    typeof params?.otherDisplayName === "string" &&
    params.otherDisplayName.trim()
      ? params.otherDisplayName.trim()
      : "";

  const contextType = useMemo(() => {
    const raw =
      typeof params?.contextType === "string" ? params.contextType : "";
    const v = raw.trim().toLowerCase();
    if (v === "event" || v === "plan") {
      return v;
    }
    return null;
  }, [params?.contextType]);

  const contextInterest = useMemo(() => {
    const raw =
      typeof params?.contextInterest === "string" ? params.contextInterest : "";
    const v = raw.trim();
    return v ? v : null;
  }, [params?.contextInterest]);

  const contextLocationName = useMemo(() => {
    const raw =
      typeof params?.contextLocationName === "string"
        ? params.contextLocationName
        : "";
    const v = raw.trim();
    return v ? v : null;
  }, [params?.contextLocationName]);

  const contextEventTitle = useMemo(() => {
    const raw =
      typeof params?.contextEventTitle === "string"
        ? params.contextEventTitle
        : "";
    const v = raw.trim();
    return v ? v : null;
  }, [params?.contextEventTitle]);

  const starterMessage = useMemo(() => {
    const raw = params?.starterMessage;
    const safe = typeof raw === "string" ? raw.trim() : "";
    return safe ? safe : null;
  }, [params?.starterMessage]);

  return {
    conversationId,
    otherUserId,
    otherNameFromParams,
    contextType,
    contextInterest,
    contextLocationName,
    contextEventTitle,
    starterMessage,
  };
}
