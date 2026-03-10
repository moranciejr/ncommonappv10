import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { router, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/utils/auth";
import useUser from "@/utils/auth/useUser";

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [hasSeenIntro, setHasSeenIntro] = useState(false);
  const hasRedirected = useRef(false);
  const segments = useSegments();

  const { isAuthenticated, isReady: authReady } = useAuth();
  const { data: user, loading: userLoading } = useUser();

  // Check if user has seen intro
  useEffect(() => {
    const checkIntro = async () => {
      try {
        const introDone = await AsyncStorage.getItem("nc_intro_done");
        setHasSeenIntro(introDone === "1");
      } catch (err) {
        console.error("Failed to check intro status", err);
        setHasSeenIntro(false);
      } finally {
        setIsReady(true);
      }
    };
    checkIntro();
  }, []);

  // Route user based on auth + onboarding status
  useEffect(() => {
    if (!isReady || !authReady) {
      return;
    }
    if (hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;

    // If authenticated, check onboarding status
    if (isAuthenticated) {
      // User data is loading, wait for it
      if (userLoading) {
        return;
      }

      // Check if onboarding is complete
      const onboardingComplete = user?.onboarding?.completed;

      if (onboardingComplete) {
        // User is fully set up → go to map
        router.replace("/(tabs)/map");
      } else {
        // User is authenticated but hasn't completed onboarding
        router.replace("/onboarding");
      }
    } else {
      // Not authenticated
      if (hasSeenIntro) {
        // Returning user who has seen intro → show intro with option to sign in
        router.replace("/intro");
      } else {
        // First-time user → show intro
        router.replace("/intro");
      }
    }
  }, [isReady, authReady, isAuthenticated, user, userLoading, hasSeenIntro]);

  // Show loading indicator while determining route
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0c10",
      }}
    >
      <ActivityIndicator color="#F5C842" />
    </View>
  );
}
