import { useCallback, useMemo, useState, createElement } from "react";
import { RefreshControl } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateMany } from "@/utils/retryQueries";
import { colors } from "@/utils/theme";

export function usePullToRefresh({ queryKeys, onRefresh, tintColor } = {}) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const safeTint = typeof tintColor === "string" ? tintColor : colors.primary;

  const doRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);
    try {
      const keys = Array.isArray(queryKeys) ? queryKeys : [];
      if (keys.length) {
        await invalidateMany(queryClient, keys);
      }
      if (typeof onRefresh === "function") {
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, queryClient, queryKeys, refreshing]);

  const refreshControl = useMemo(() => {
    // NOTE: This file is .js, so avoid JSX.
    return createElement(RefreshControl, {
      refreshing,
      onRefresh: doRefresh,
      tintColor: safeTint,
      colors: [safeTint],
    });
  }, [doRefresh, refreshing, safeTint]);

  return { refreshing, onRefresh: doRefresh, refreshControl };
}
