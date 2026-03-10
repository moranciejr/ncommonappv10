import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { isoToDisplayDate } from "@/utils/dateValidation";

export function useOnboardingState(initialOnboardingResolved, startStep) {
  const params = useLocalSearchParams();

  const startStepFromParams = useMemo(() => {
    const raw = params?.startStep;
    const asString =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
    const parsed = asString ? parseInt(asString, 10) : null;
    if (typeof parsed !== "number" || Number.isNaN(parsed)) {
      return null;
    }
    return parsed;
  }, [params?.startStep]);

  const startStepEffective = useMemo(() => {
    if (typeof startStep === "number") {
      return startStep;
    }
    if (typeof startStepFromParams === "number") {
      return startStepFromParams;
    }
    return 0;
  }, [startStep, startStepFromParams]);

  const initialStepValue = useMemo(() => {
    return Math.min(2, Math.max(0, startStepEffective));
  }, [startStepEffective]);

  const [step, setStep] = useState(initialStepValue);
  const [error, setError] = useState(null);

  useEffect(() => {
    setStep(initialStepValue);
  }, [initialStepValue]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");

  const [dobText, setDobText] = useState("");
  const [showAge, setShowAge] = useState(false);

  const [interests, setInterests] = useState([]);
  const [interestSearch, setInterestSearch] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");
  const [pickedAsset, setPickedAsset] = useState(null);
  const [pickedPreviewNonce, setPickedPreviewNonce] = useState(0);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState("");

  useEffect(() => {
    const profile = initialOnboardingResolved?.profile;
    const initialInterests = initialOnboardingResolved?.interests;
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setCity(profile.city || "");
      setStateName(profile.state || "");
      setAvatarUrl(profile.avatarUrl || "");

      setDobText(isoToDisplayDate(profile.dateOfBirth || ""));
      setShowAge(!!profile.showAge);
    }
    if (Array.isArray(initialInterests) && initialInterests.length) {
      setInterests(initialInterests);
    }
  }, [initialOnboardingResolved]);

  return {
    step,
    setStep,
    error,
    setError,
    displayName,
    setDisplayName,
    bio,
    setBio,
    city,
    setCity,
    stateName,
    setStateName,
    dobText,
    setDobText,
    showAge,
    setShowAge,
    interests,
    setInterests,
    interestSearch,
    setInterestSearch,
    avatarUrl,
    setAvatarUrl,
    pickedAsset,
    setPickedAsset,
    pickedPreviewNonce,
    setPickedPreviewNonce,
    avatarPreviewUri,
    setAvatarPreviewUri,
  };
}
