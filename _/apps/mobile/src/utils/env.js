// Small env helpers so we can reliably hide dev-only UI in production builds.
// In Expo, only EXPO_PUBLIC_* vars are guaranteed to exist at runtime.

export function getCreateEnv() {
  const raw =
    (process.env.EXPO_PUBLIC_CREATE_ENV || process.env.NODE_ENV || "") + "";
  return raw.trim().toLowerCase();
}

export function isProdBuild() {
  return getCreateEnv() === "production";
}

export function isDevBuild() {
  return !isProdBuild();
}

// Use the same logic we use for dev actions on the map.
// We keep dev UI visible unless BOTH envs explicitly say production.
export function shouldShowDevUi() {
  const devFlag =
    typeof globalThis !== "undefined" && globalThis
      ? Boolean(globalThis.__DEV__)
      : false;

  if (devFlag) {
    return true;
  }

  const createEnv = (process.env.EXPO_PUBLIC_CREATE_ENV || "").toLowerCase();
  const platformEnv = (process.env.ENV || "").toLowerCase();

  return !(createEnv === "production" && platformEnv === "production");
}
