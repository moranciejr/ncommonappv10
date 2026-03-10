import { useCallback } from "react";
import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function useBlockUser({ closeSheet, setSelectedCard }) {
  const queryClient = useQueryClient();

  const blockMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/blocks, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      closeSheet();
      setSelectedCard(null);

      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });

      setTimeout(() => {
        Alert.alert("Blocked", "They won't show up for you anymore.");
      }, 250);
    },
    onError: (err) => {
      console.error(err);
      setTimeout(() => {
        Alert.alert("Could not block", "Please try again.");
      }, 150);
    },
  });

  const handleUserLongPress = useCallback(
    (u) => {
      if (!u?.userId) {
        return;
      }
      if (u.isMine) {
        return;
      }
      const nameForUi = u.displayName || "this user";
      Alert.alert(
        `Block ${nameForUi}?`,
        "They will disappear from your map and lists, and messaging will be blocked.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: () => {
              if (blockMutation.isPending) {
                return;
              }
              blockMutation.mutate({ targetUserId: u.userId });
            },
          },
        ],
      );
    },
    [blockMutation],
  );

  return {
    blockMutation,
    handleUserLongPress,
  };
}
