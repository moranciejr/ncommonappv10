import { useMemo } from "react";
import {
  getTaxonomyItems,
  getGroupedTaxonomyItems,
  getInterestLabel,
  normalizeInterest as normalizeInterestValue,
} from "@/utils/interestTaxonomy";

export function useInterestSelection(
  interests,
  setInterests,
  interestSearch,
  setError,
) {
  const taxonomyItems = useMemo(() => {
    return getTaxonomyItems();
  }, []);

  const groupedTaxonomy = useMemo(() => {
    return getGroupedTaxonomyItems();
  }, []);

  const searchResults = useMemo(() => {
    const q = normalizeInterestValue(interestSearch);
    if (!q) {
      return [];
    }

    return taxonomyItems
      .filter((it) => {
        const label = normalizeInterestValue(it.label);
        const value = normalizeInterestValue(it.value);
        return label.includes(q) || value.includes(q);
      })
      .slice(0, 80);
  }, [interestSearch, taxonomyItems]);

  const selectedLabels = useMemo(() => {
    if (!Array.isArray(interests) || !interests.length) {
      return "";
    }
    return interests
      .map((it) => getInterestLabel(it) || it)
      .filter(Boolean)
      .join(", ");
  }, [interests]);

  const toggleInterest = (value) => {
    const normalized = normalizeInterestValue(value);
    if (!normalized) {
      return;
    }

    const isSelected = interests.includes(normalized);

    if (isSelected) {
      const next = interests.filter((i) => i !== normalized);
      setInterests(next);
      return;
    }

    if (interests.length >= 10) {
      setError("Pick up to 10 interests.");
      return;
    }

    setInterests([...interests, normalized]);
  };

  return {
    taxonomyItems,
    groupedTaxonomy,
    searchResults,
    selectedLabels,
    toggleInterest,
  };
}
