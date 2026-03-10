import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";

export function useProductivityHabits() {
  return useQuery({
    queryKey: ["productivityHabits"],
    queryFn: async () => {
      const response = await authedFetch("/api/productivity/habits");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/productivity/habits, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, category }) => {
      const response = await authedFetch("/api/productivity/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/productivity/habits (POST), the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["productivityHabits"] });
    },
  });
}

export function useToggleHabitDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, done }) => {
      const response = await authedFetch(
        `/api/productivity/habits/${habitId}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/productivity/habits/${habitId}/toggle, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onMutate: async ({ habitId, done }) => {
      await queryClient.cancelQueries({ queryKey: ["productivityHabits"] });
      const prev = queryClient.getQueryData(["productivityHabits"]);

      // Optimistically toggle doneToday.
      queryClient.setQueryData(["productivityHabits"], (old) => {
        if (!old || typeof old !== "object") {
          return old;
        }
        const habits = Array.isArray(old.habits) ? old.habits : [];
        const nextHabits = habits.map((h) => {
          if (h?.id !== habitId) {
            return h;
          }
          const nextDone = typeof done === "boolean" ? done : !h.doneToday;
          const nextStreak = nextDone
            ? Math.max(1, Number(h.streak || 0) + (h.doneToday ? 0 : 1))
            : Math.max(0, Number(h.streak || 0) - (h.doneToday ? 1 : 0));
          return { ...h, doneToday: nextDone, streak: nextStreak };
        });

        const doneTodayCount = nextHabits.filter((h) => h?.doneToday).length;
        const nextSummary = old.summary
          ? {
              ...old.summary,
              totalHabits: nextHabits.length,
              doneToday: doneTodayCount,
            }
          : old.summary;

        return { ...old, habits: nextHabits, summary: nextSummary };
      });

      return { prev };
    },
    onError: async (err, _variables, ctx) => {
      console.error(err);
      if (ctx?.prev) {
        queryClient.setQueryData(["productivityHabits"], ctx.prev);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["productivityHabits"] });
    },
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, isArchived }) => {
      const response = await authedFetch(
        `/api/productivity/habits/${habitId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isArchived }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/productivity/habits/${habitId} (PATCH), the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["productivityHabits"] });
    },
  });
}

export function useHabitCategories() {
  return useCallback(() => {
    return [
      { key: "general", label: "General" },
      { key: "health", label: "Health" },
      { key: "fitness", label: "Fitness" },
      { key: "work", label: "Work" },
      { key: "study", label: "Study" },
      { key: "mind", label: "Mind" },
    ];
  }, []);
}
