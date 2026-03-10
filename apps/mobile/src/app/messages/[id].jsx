import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import { useAuth } from "@/utils/auth/useAuth";
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { useNCommonWithUser } from "@/hooks/useNCommonWithUser";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { useConversationParams } from "@/hooks/useConversationParams";
import { useConversationData } from "@/hooks/useConversationData";
import { useConversationSuggestions } from "@/hooks/useConversationSuggestions";
import { useConversationActions } from "@/hooks/useConversationActions";
import { useKeyboardPaddingAnimation } from "@/hooks/useKeyboardPaddingAnimation";
import { ConversationHeader } from "@/components/Messages/ConversationHeader";
import { MessagesList } from "@/components/Messages/MessagesList";
import { MessageComposer } from "@/components/Messages/MessageComposer";
import { darkTheme } from "@/utils/theme";
import { safeBack } from "@/utils/navigation";
import { friendlyErrorMessage } from "@/utils/errors";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const { colors, radius, shadow, typography, spacing } = darkTheme;

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { auth } = useAuth();

  // NEW: "tone" for suggestions. Keep it tiny and only for empty chats.
  const [tone, setTone] = useState("chill");

  const currentUserId = useMemo(() => {
    const raw = auth?.user?.id;
    const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [auth?.user?.id]);

  const {
    conversationId,
    otherUserId,
    otherNameFromParams,
    contextType,
    contextInterest,
    contextLocationName,
    contextEventTitle,
    starterMessage,
  } = useConversationParams();

  const { messagesQuery, otherUserFromApi, otherUserIdEffective, messages } =
    useConversationData(conversationId);

  const refreshKeys = useMemo(() => {
    if (!conversationId) {
      return [];
    }
    return [["conversation", { conversationId }], ["conversations"]];
  }, [conversationId]);

  const { refreshControl } = usePullToRefresh({
    queryKeys: refreshKeys,
  });

  // NEW: refetch the conversation when the screen comes back into focus.
  const lastFocusRefreshRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusRefreshRef.current < 4000) {
        return;
      }
      lastFocusRefreshRef.current = now;
      try {
        messagesQuery.refetch();
      } catch (err) {
        console.error(err);
      }
    }, [messagesQuery.refetch]),
  );

  // NEW: reset tone when switching conversations so it feels predictable.
  useEffect(() => {
    setTone("chill");
  }, [conversationId]);

  const finalOtherUserId = useMemo(() => {
    return otherUserId || otherUserIdEffective;
  }, [otherUserId, otherUserIdEffective]);

  const otherName = useMemo(() => {
    if (otherNameFromParams) {
      return otherNameFromParams;
    }
    const apiName =
      typeof otherUserFromApi?.displayName === "string"
        ? otherUserFromApi.displayName.trim()
        : "";
    return apiName || "Chat";
  }, [otherNameFromParams, otherUserFromApi?.displayName]);

  const ncommonTargetId = useMemo(() => {
    if (!finalOtherUserId) {
      return null;
    }
    if (
      typeof currentUserId === "number" &&
      finalOtherUserId === currentUserId
    ) {
      return null;
    }
    return finalOtherUserId;
  }, [currentUserId, finalOtherUserId]);

  const ncommonQuery = useNCommonWithUser(ncommonTargetId);

  const ncommonCount = useMemo(() => {
    const n = ncommonQuery.data?.overlapCount;
    return typeof n === "number" ? n : null;
  }, [ncommonQuery.data?.overlapCount]);

  const ncommonChips = useMemo(() => {
    const list = ncommonQuery.data?.overlapInterests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list
      .map((i) => getInterestLabel(i) || i)
      .filter(Boolean)
      .slice(0, 3);
  }, [ncommonQuery.data?.overlapInterests]);

  const {
    quickStarters,
    icebreakers,
    shouldShowQuickStarters,
    shouldShowIcebreakers,
    tone: normalizedTone,
  } = useConversationSuggestions({
    contextType,
    contextInterest,
    contextLocationName,
    contextEventTitle,
    ncommonChips,
    otherName,
    messages,
    isLoading: messagesQuery.isLoading,
    tone,
  });

  const [draft, setDraft] = useState("");
  const didApplyStarterRef = useRef(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // NEW: make send failures non-destructive (restore text if the send fails)
  const handleSendFailed = useCallback((text) => {
    const t = typeof text === "string" ? text.trim() : "";
    if (!t) {
      return;
    }
    setDraft((prev) => {
      const prevTrim = typeof prev === "string" ? prev.trim() : "";
      return prevTrim ? prev : t;
    });
  }, []);

  const { sendMutation, onMore, error, prompt, setPrompt } =
    useConversationActions({
      conversationId,
      currentUserId,
      otherUserIdEffective: finalOtherUserId,
      otherName,
      onSendFailed: handleSendFailed,
    });

  const { paddingAnimation, handleInputFocus, handleInputBlur } =
    useKeyboardPaddingAnimation(insets);

  const quickStarterTitle = useMemo(() => {
    const hasDraft = typeof draft === "string" && draft.trim().length > 0;
    if (hasDraft) {
      return "Try a different opener";
    }
    return "Quick starters";
  }, [draft]);

  const insertSuggestedText = useCallback(
    (text) => {
      const next = typeof text === "string" ? text.trim() : "";
      if (!next) {
        return;
      }

      setDraft((prev) => {
        const prevText = typeof prev === "string" ? prev.trim() : "";
        if (!prevText) {
          return next;
        }
        return `${prevText}\n${next}`;
      });

      try {
        if (inputRef.current && typeof inputRef.current.focus === "function") {
          inputRef.current.focus();
        }
      } catch (err) {
        console.error(err);
      }
    },
    [setDraft],
  );

  const applyQuickStarter = useCallback(
    (text) => {
      insertSuggestedText(text);
    },
    [insertSuggestedText],
  );

  useEffect(() => {
    if (didApplyStarterRef.current) {
      return;
    }
    if (!starterMessage) {
      return;
    }
    if (messagesQuery.isLoading) {
      return;
    }
    if (messages.length > 0) {
      return;
    }
    if (typeof draft === "string" && draft.trim()) {
      return;
    }
    didApplyStarterRef.current = true;
    setDraft(starterMessage);
  }, [draft, messages.length, messagesQuery.isLoading, starterMessage]);

  // NEW: detect blocked/removed conversations so we don't let users type into a dead chat.
  const chatStatus = useMemo(() => {
    const s = messagesQuery?.error?.status;
    return typeof s === "number" ? s : null;
  }, [messagesQuery?.error]);

  const isChatUnavailable = chatStatus === 404;

  const canSend = useMemo(() => {
    const text = typeof draft === "string" ? draft.trim() : "";
    return (
      !!conversationId &&
      !sendMutation.isPending &&
      !!text &&
      !isChatUnavailable
    );
  }, [conversationId, draft, isChatUnavailable, sendMutation.isPending]);

  const onSend = useCallback(() => {
    if (!conversationId || sendMutation.isPending) {
      return;
    }
    const text = typeof draft === "string" ? draft.trim() : "";
    if (!text) {
      return;
    }

    // Use a stable client id so the optimistic message can be replaced on success.
    const clientId = `optimistic-${Date.now()}`;

    setDraft("");
    sendMutation.mutate({ text, clientId });
  }, [conversationId, draft, sendMutation]);

  const onToneChange = useCallback((nextTone) => {
    const t = typeof nextTone === "string" ? nextTone.trim().toLowerCase() : "";
    if (t !== "chill" && t !== "funny" && t !== "direct") {
      return;
    }
    setTone(t);
  }, []);

  if (!conversationId) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text style={{ ...typography.heading.lg, color: colors.text }}>
          Could not open chat
        </Text>
        <Text
          style={{
            marginTop: spacing.xs,
            ...typography.body.mdBold,
            color: colors.subtext,
            textAlign: "center",
            lineHeight: 18,
          }}
        >
          Try going back and opening it again.
        </Text>

        <TouchableOpacity
          onPress={() => safeBack(router, "/messages")}
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.base,
            borderRadius: radius.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.lgBold, color: colors.text }}>
            Back to Messages
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading = messagesQuery.isLoading;

  // Compute the load error without additional hooks so we don't violate the Rules of Hooks.
  const chatLoadErrorMessage = messagesQuery.error
    ? isChatUnavailable
      ? "This chat is no longer available."
      : friendlyErrorMessage(messagesQuery.error, "Could not load chat.")
    : null;

  const errorMessage = error || chatLoadErrorMessage;

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        <UpgradePromptModal
          visible={!!prompt}
          title={prompt?.title}
          message={prompt?.message}
          primaryText={prompt?.primaryCta || "Continue"}
          secondaryText={prompt?.secondaryCta || "Not now"}
          onPrimary={() => {
            const target = prompt?.target || "/verify-email";
            setPrompt(null);
            router.push(target);
          }}
          onClose={() => setPrompt(null)}
        />

        <ConversationHeader
          otherName={otherName}
          ncommonTargetId={ncommonTargetId}
          ncommonQuery={ncommonQuery}
          ncommonCount={ncommonCount}
          ncommonChips={ncommonChips}
          onBack={() => safeBack(router, "/messages")}
          onMore={onMore}
        />

        <MessagesList
          ref={scrollRef}
          messages={messages}
          currentUserId={currentUserId}
          isLoading={isLoading}
          errorMessage={errorMessage}
          shouldShowQuickStarters={shouldShowQuickStarters}
          quickStarterTitle={quickStarterTitle}
          quickStarters={quickStarters}
          shouldShowIcebreakers={shouldShowIcebreakers}
          icebreakers={icebreakers}
          onSelectStarter={applyQuickStarter}
          tone={normalizedTone}
          onToneChange={onToneChange}
          refreshControl={refreshControl}
        />

        <MessageComposer
          draft={draft}
          onChangeDraft={setDraft}
          onSend={onSend}
          isSending={sendMutation.isPending}
          canSend={canSend}
          inputDisabled={isChatUnavailable}
          paddingAnimation={paddingAnimation}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          inputRef={inputRef}
        />
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
