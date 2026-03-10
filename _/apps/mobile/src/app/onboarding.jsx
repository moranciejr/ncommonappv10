import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import useUpload from "@/utils/useUpload";
import { parseDobToISODate } from "@/utils/dateValidation";
import { useOnboardingData } from "@/hooks/useOnboardingData";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { useImagePicker } from "@/hooks/useImagePicker";
import { useOnboardingCompletion } from "@/hooks/useOnboardingCompletion";
import { useInterestSelection } from "@/hooks/useInterestSelection";
import { OnboardingHeader } from "@/components/Onboarding/OnboardingHeader";
import { ErrorMessage } from "@/components/Onboarding/ErrorMessage";
import { ProfileStep } from "@/components/Onboarding/ProfileStep";
import { InterestsStep } from "@/components/Onboarding/InterestsStep";
import { PhotoStep } from "@/components/Onboarding/PhotoStep";
import { PrimaryButton } from "@/components/Onboarding/PrimaryButton";
import { SecondaryButton } from "@/components/Onboarding/SecondaryButton";
import { safeBack } from "@/utils/navigation";
import { lightTheme } from "@/utils/theme";

const { colors, typography, spacing } = lightTheme;

export default function OnboardingScreen({
  initialOnboarding,
  onDone,
  startStep,
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const editMode = params?.edit === "1" || params?.edit === "true";

  const startStepFromParams = useMemo(() => {
    if (typeof startStep === "number") {
      return startStep;
    }
    const raw = params?.startStep;
    const parsed = typeof raw === "string" ? parseInt(raw, 10) : null;
    if (typeof parsed === "number" && !Number.isNaN(parsed)) {
      return parsed;
    }
    return 0;
  }, [params?.startStep, startStep]);

  const focusedPadding = 12;

  const { initialOnboardingResolved, isLoading } =
    useOnboardingData(initialOnboarding);

  const {
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
  } = useOnboardingState(initialOnboardingResolved, startStepFromParams);

  const { paddingAnimation, handleInputFocus, handleInputBlur } =
    useKeyboardPadding(insets, focusedPadding);

  const [upload, { loading: uploadLoading }] = useUpload();

  const { pickImage, uploadAvatar } = useImagePicker({
    setError,
    setAvatarUrl,
    setAvatarPreviewUri,
    setPickedAsset,
    setPickedPreviewNonce,
    upload,
  });

  const { groupedTaxonomy, searchResults, selectedLabels, toggleInterest } =
    useInterestSelection(interests, setInterests, interestSearch, setError);

  const completeMutation = useOnboardingCompletion({
    displayName,
    bio,
    city,
    stateName,
    avatarUrl,
    interests,
    dobText,
    showAge,
    setError,
    onDone,
  });

  const canContinueProfile = useMemo(() => {
    const name = displayName.trim();
    if (name.length < 2) {
      return false;
    }
    const parsed = parseDobToISODate(dobText);
    return !!parsed.iso && !parsed.error;
  }, [displayName, dobText]);

  const canContinueInterests = useMemo(() => {
    return interests.length >= 1 && interests.length <= 10;
  }, [interests.length]);

  // While the user just picked a photo, we auto-upload it. During that upload,
  // we temporarily disable Finish so they don't accidentally complete without the new photo.
  const photoUploading = useMemo(() => {
    return !!pickedAsset && !!uploadLoading;
  }, [pickedAsset, uploadLoading]);

  const headerText = useMemo(() => {
    if (step === 0) {
      return "Set up your profile";
    }
    if (step === 1) {
      return "What are you into?";
    }
    return "Add a photo";
  }, [step]);

  const subText = useMemo(() => {
    if (step === 0) {
      return "A real name and a short bio help keep the community safe.";
    }
    if (step === 1) {
      return "Pick a few things you actually want to do with other people.";
    }
    return "Optional — but it helps people trust the match.";
  }, [step]);

  const showFinishLoading = completeMutation.isPending;

  // NOTE: we intentionally do not pre-disable the Finish button based on earlier steps.
  // If required info is missing, we guide the user back when they tap Finish.

  const primaryTitle = useMemo(() => {
    if (step < 2) {
      return "Continue";
    }
    if (showFinishLoading) {
      return "Finishing…";
    }
    if (photoUploading) {
      return "Uploading photo…";
    }
    return "Finish";
  }, [photoUploading, showFinishLoading, step]);

  const primaryDisabled = useMemo(() => {
    // Avoid the "stuck" feeling: let users tap Continue and we show a clear error message,
    // rather than disabling the button with no explanation.
    if (step < 2) {
      return false;
    }

    // Step 2 (photo): prevent double-submits / finishing mid-upload.
    return showFinishLoading || photoUploading;
  }, [photoUploading, showFinishLoading, step]);

  const onNext = () => {
    setError(null);
    if (step === 0) {
      if (!displayName.trim() || displayName.trim().length < 2) {
        setError("Please enter a display name (at least 2 characters).");
        return;
      }

      const parsed = parseDobToISODate(dobText);
      if (!parsed.iso) {
        setError(parsed.error || "Please enter your date of birth.");
        return;
      }

      setStep(1);
      return;
    }
    if (step === 1) {
      if (!canContinueInterests) {
        setError("Pick at least 1 interest (up to 10).");
        return;
      }
      setStep(2);
      return;
    }

    // Step 2: if required info is missing (common when entering via edit flows),
    // send them back to the right step instead of silently disabling Finish.
    if (!canContinueProfile) {
      setError("Quick check: please finish your profile details first.");
      setStep(0);
      return;
    }

    if (!canContinueInterests) {
      setError("Quick check: pick at least 1 interest before finishing.");
      setStep(1);
      return;
    }

    if (photoUploading) {
      setError(
        "Your photo is still uploading — give it a sec, then tap Finish.",
      );
      return;
    }

    completeMutation.mutate();
  };

  const onBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  // Android hardware back: step back within onboarding before leaving the screen.
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 0) {
          setError(null);
          setStep((s) => Math.max(0, s - 1));
          return true;
        }

        // In edit flows (ex: /onboarding?edit=1&startStep=1), allow leaving onboarding.
        if (editMode) {
          safeBack(router, "/settings");
          return true;
        }

        // Let the system handle it (usually exits app if this is the root screen).
        return false;
      },
    );

    return () => subscription.remove();
  }, [editMode, router, step]);

  const onboardingCompleted = !!initialOnboardingResolved?.completed;

  // remove webBaseUrl/privacyUrl/termsUrl helpers (we open legal in-app now)

  const openLegal = (doc) => {
    // Always prefer the in-app viewer.
    // If base URL isn't configured, the Legal screen shows a helpful error.
    router.push({ pathname: "/legal", params: { doc } });
  };

  // Only auto-redirect if this is the real first-time onboarding flow.
  useEffect(() => {
    if (!onboardingCompleted) {
      return;
    }
    if (editMode) {
      return;
    }
    router.replace("/map");
  }, [editMode, onboardingCompleted, router]);

  // While we redirect, render a simple loading state.
  if (onboardingCompleted && !editMode) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Add a loading state when used as a routed page
  if (!initialOnboardingResolved && isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: paddingAnimation,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OnboardingHeader
            headerText={headerText}
            subText={subText}
            step={step}
          />

          <ErrorMessage error={error} />

          {step === 0 ? (
            <ProfileStep
              displayName={displayName}
              setDisplayName={setDisplayName}
              dobText={dobText}
              setDobText={setDobText}
              bio={bio}
              setBio={setBio}
              city={city}
              setCity={setCity}
              stateName={stateName}
              setStateName={setStateName}
              showAge={showAge}
              setShowAge={setShowAge}
              handleInputFocus={handleInputFocus}
              handleInputBlur={handleInputBlur}
            />
          ) : null}

          {step === 1 ? (
            <InterestsStep
              interestSearch={interestSearch}
              setInterestSearch={setInterestSearch}
              searchResults={searchResults}
              groupedTaxonomy={groupedTaxonomy}
              interests={interests}
              toggleInterest={toggleInterest}
              selectedLabels={selectedLabels}
              handleInputFocus={handleInputFocus}
              handleInputBlur={handleInputBlur}
            />
          ) : null}

          {step === 2 ? (
            <PhotoStep
              avatarPreviewUri={avatarPreviewUri}
              avatarUrl={avatarUrl}
              pickedPreviewNonce={pickedPreviewNonce}
              pickImage={pickImage}
              uploadLoading={uploadLoading}
              pickedAsset={pickedAsset}
              uploadAvatar={() => uploadAvatar(pickedAsset)}
            />
          ) : null}

          <View style={{ height: 24 }} />

          <View style={{ gap: spacing.base }}>
            {step > 0 || editMode ? (
              <SecondaryButton
                title={step > 0 ? "Back" : "Cancel"}
                onPress={() => {
                  if (step > 0) {
                    onBack();
                    return;
                  }
                  safeBack(router, "/settings");
                }}
              />
            ) : null}

            <PrimaryButton
              title={primaryTitle}
              onPress={onNext}
              disabled={primaryDisabled}
            />

            {step === 2 ? (
              <Text
                style={{
                  marginTop: spacing.xs,
                  ...typography.label.sm,
                  color: colors.subtext,
                  textAlign: "center",
                  lineHeight: 16,
                }}
              >
                By continuing, you agree to our{" "}
                <Text
                  onPress={() => openLegal("terms")}
                  style={{ color: colors.purple, ...typography.label.smBold }}
                  suppressHighlighting
                >
                  Terms
                </Text>{" "}
                and{" "}
                <Text
                  onPress={() => openLegal("privacy")}
                  style={{ color: colors.purple, ...typography.label.smBold }}
                  suppressHighlighting
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            ) : null}
          </View>

          {completeMutation.isPending ? (
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingAnimatedView>
  );
}
