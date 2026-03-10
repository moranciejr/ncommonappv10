import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect } from "react";
import { useAuthModal, useAuthStore, authKey } from "./store";

/**
 * This hook provides authentication functionality.
 */
export const useAuth = () => {
  const { isReady, auth, setAuth } = useAuthStore();
  const { close, open } = useAuthModal();

  const initiate = useCallback(() => {
    const run = async () => {
      let parsed = null;

      try {
        const raw = await SecureStore.getItemAsync(authKey);

        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch (err) {
            console.error("Failed to parse stored auth; clearing it", err);
            await SecureStore.deleteItemAsync(authKey).catch(() => {});
            parsed = null;
          }
        }
      } catch (err) {
        console.error("Failed to read stored auth; continuing signed out", err);
        parsed = null;
      } finally {
        // ALWAYS set isReady to true, even if there's an error
        useAuthStore.setState({
          auth: parsed,
          isReady: true,
        });
      }
    };

    // Run and catch any unhandled errors
    run().catch((err) => {
      console.error("Unexpected error in auth initiate", err);
      // Ensure isReady is set even on catastrophic failure
      useAuthStore.setState({
        auth: null,
        isReady: true,
      });
    });
  }, []);

  useEffect(() => {}, []);

  const signIn = useCallback(() => {
    open({ mode: "signin" });
  }, [open]);

  const signUp = useCallback(() => {
    open({ mode: "signup" });
  }, [open]);

  const signOut = useCallback(() => {
    setAuth(null);
    close();
  }, [close, setAuth]);

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    initiate,
  };
};

/**
 * This hook will automatically open the authentication modal if the user is not authenticated.
 */
export const useRequireAuth = (options) => {
  const { isAuthenticated, isReady } = useAuth();
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
