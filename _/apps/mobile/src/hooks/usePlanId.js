import { useMemo } from "react";

export function usePlanId(rawId) {
  return useMemo(() => {
    const first = Array.isArray(rawId) ? rawId[0] : rawId;

    const n = typeof first === "string" ? parseInt(first, 10) : Number(first);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }, [rawId]);
}
