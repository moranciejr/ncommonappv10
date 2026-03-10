import { useCallback, useRef } from "react";
import { Animated, Platform } from "react-native";

export function useKeyboardPaddingAnimation(insets) {
  const focusedPadding = 12;
  const paddingAnimation = useRef(
    new Animated.Value(insets.bottom + focusedPadding),
  ).current;

  const animateTo = useCallback(
    (value) => {
      Animated.timing(paddingAnimation, {
        toValue: value,
        duration: 200,
        useNativeDriver: false,
      }).start();
    },
    [paddingAnimation],
  );

  const handleInputFocus = useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    animateTo(focusedPadding);
  }, [animateTo]);

  const handleInputBlur = useCallback(() => {
    if (Platform.OS === "web") {
      return;
    }
    animateTo(insets.bottom + focusedPadding);
  }, [animateTo, insets.bottom]);

  return {
    paddingAnimation,
    handleInputFocus,
    handleInputBlur,
  };
}
