import React from "react";
import { Modal, View, Platform } from "react-native";
import { AuthWebView } from "./AuthWebView.jsx";
import { useAuthStore, useAuthModal } from "./store";

// Root-level auth modal. Call signIn()/signUp() from useAuth to open it.
export const AuthModal = () => {
  const { isOpen, mode, close } = useAuthModal();
  const { auth } = useAuthStore();

  const proxyURL = process.env.EXPO_PUBLIC_PROXY_BASE_URL;
  const baseURL = process.env.EXPO_PUBLIC_BASE_URL;

  if (!proxyURL && !baseURL) {
    return null;
  }

  return (
    <Modal
      visible={isOpen && !auth}
      transparent={false} // IMPORTANT: transparent modals can cause iOS keyboard "jumping" in WebViews
      presentationStyle="fullScreen"
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <AuthWebView
          mode={mode}
          proxyURL={proxyURL}
          baseURL={baseURL}
          onClose={close}
        />
      </View>
    </Modal>
  );
};

export default useAuthModal;
