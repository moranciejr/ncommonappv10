import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { useAuth } from "@/utils/auth/useAuth";

export function useAccountActions() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  const clearActivityMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/account/clear-activity", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/account/clear-activity, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      await queryClient.invalidateQueries({ queryKey: ["checkins"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not clear", "Please try again.");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/account/delete, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      Alert.alert(
        "Account deleted",
        "Your account has been removed. You will be signed out.",
      );
      await signOut();
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not delete", "Please try again.");
    },
  });

  return {
    clearActivityMutation,
    deleteAccountMutation,
  };
}
