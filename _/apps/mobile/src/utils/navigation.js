export function safeBack(router, fallbackPath = "/") {
  // expo-router's router sometimes has canGoBack(); in some runtimes it may not.
  // Deep links can open a screen with no history stack, so router.back() can be a no-op.
  try {
    if (router && typeof router.canGoBack === "function") {
      const can = router.canGoBack();
      if (can) {
        router.back();
        return;
      }
      if (typeof router.replace === "function") {
        router.replace(fallbackPath);
        return;
      }
    }
  } catch (_e) {
    // ignore
  }

  try {
    if (router && typeof router.back === "function") {
      router.back();
      return;
    }
  } catch (_e) {
    // ignore
  }

  try {
    if (router && typeof router.replace === "function") {
      router.replace(fallbackPath);
    }
  } catch (_e) {
    // ignore
  }
}
