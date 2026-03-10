import { useCallback, useMemo, useRef, useState } from "react";

export function useMapInteractions({ setSelectedInterest }) {
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["22%", "55%", "88%"], []);
  const [selectedCard, setSelectedCard] = useState(null);

  const openSheet = useCallback((toIndex) => {
    try {
      const idx = typeof toIndex === "number" ? toIndex : 1;
      if (
        sheetRef.current &&
        typeof sheetRef.current.snapToIndex === "function"
      ) {
        sheetRef.current.snapToIndex(idx);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const closeSheet = useCallback(() => {
    try {
      if (sheetRef.current && typeof sheetRef.current.close === "function") {
        sheetRef.current.close();
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const onToggleInterest = useCallback(
    (interest) => {
      setSelectedCard({ type: "interest", data: { interest } });
      setSelectedInterest((current) => {
        if (current === interest) {
          return null;
        }
        return interest;
      });
      openSheet(1);
    },
    [openSheet, setSelectedInterest],
  );

  return {
    sheetRef,
    snapPoints,
    selectedCard,
    setSelectedCard,
    openSheet,
    closeSheet,
    onToggleInterest,
  };
}
