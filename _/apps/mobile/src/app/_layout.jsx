import { useAuth } from "@/utils/auth/useAuth";
import { useAuthStore } from "@/utils/auth/store";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthModal } from "@/utils/auth/useAuthModal";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { theme } from "@/utils/theme";
import {
  getHttpStatusFromError,
  isNetworkError,
  isTimeoutError,
} from "@/utils/errors";
import usePushRegistration from "@/hooks/usePushRegistration";

// No splash screen - removed SplashScreen imports and management

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // Support both React Query v4 (cacheTime) and v5 (gcTime)
      cacheTime: 1000 * 60 * 30, // 30 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => {
        // Keep retries conservative to avoid "infinite loading" on bad connections.
        if (failureCount >= 2) {
          return false;
        }

        if (isNetworkError(error) || isTimeoutError(error)) {
          return true;
        }

        const status = getHttpStatusFromError(error);
        if (status && status >= 500) {
          return true;
        }

        return false;
      },
      retryDelay: (attemptIndex) => {
        // 0, 1s, 2s
        const safe = typeof attemptIndex === "number" ? attemptIndex : 0;
        return Math.min(2000, safe * 1000);
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Inner component that has access to QueryClient context
function AppContent() {
  // Push token capture + registration (runs after /api/me resolves)
  usePushRegistration({ enabled: true });

  return (
    <>
      {/* Mount the auth modal at the root so signIn/signUp can open it */}
      <AuthModal />

      <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="checkins" />
        <Stack.Screen name="events" />
        {/* NEW: Productivity tracker */}
        <Stack.Screen name="productivity" />
        {/* Billing */}
        <Stack.Screen name="upgrade" />
        <Stack.Screen name="stripe" />
        {/* Messaging */}
        <Stack.Screen name="messages" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const { initiate } = useAuth();

  useEffect(() => {
    // Initiate auth
    try {
      initiate();
    } catch (err) {
      console.error("Failed to initiate auth", err);
    }

    // Failsafe: if auth doesn't become ready in 2s, force it
    const timeout = setTimeout(() => {
      const state = useAuthStore.getState();
      if (!state.isReady) {
        console.warn("Auth initialization timed out, forcing ready state");
        useAuthStore.setState({ isReady: true, auth: null });
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [initiate]);

  // Render immediately - no black screen
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <AppErrorBoundary>
            <AppContent />
          </AppErrorBoundary>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
