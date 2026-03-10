export function isNetworkError(error) {
  if (!error) {
    return false;
  }

  const code = error?.code;
  if (code === "NETWORK_ERROR") {
    return true;
  }

  const msg = typeof error?.message === "string" ? error.message : "";
  const lowered = msg.toLowerCase();

  // Common fetch failure messages across platforms.
  if (lowered.includes("network request failed")) {
    return true;
  }
  if (lowered.includes("failed to fetch")) {
    return true;
  }
  if (lowered.includes("load failed")) {
    return true;
  }

  // React Query sometimes wraps errors; try a couple of common shapes.
  const causeMsg =
    typeof error?.cause?.message === "string" ? error.cause.message : "";
  const causeLowered = causeMsg.toLowerCase();
  if (causeLowered.includes("network request failed")) {
    return true;
  }
  if (causeLowered.includes("failed to fetch")) {
    return true;
  }

  return false;
}

export function isTimeoutError(error) {
  if (!error) {
    return false;
  }

  const code = error?.code;
  if (code === "TIMEOUT") {
    return true;
  }

  const msg = typeof error?.message === "string" ? error.message : "";
  const lowered = msg.toLowerCase();
  if (lowered.includes("timed out")) {
    return true;
  }

  const causeMsg =
    typeof error?.cause?.message === "string" ? error.cause.message : "";
  const causeLowered = causeMsg.toLowerCase();
  if (causeLowered.includes("timed out")) {
    return true;
  }

  return false;
}

export function getHttpStatusFromError(error) {
  const msg = typeof error?.message === "string" ? error.message : "";
  // Most of our app throws errors like:
  // "When fetching /api/xyz, the response was [500] message"
  const match = msg.match(/\[(\d{3})\]/);
  if (!match) {
    return null;
  }
  const status = parseInt(match[1], 10);
  if (!Number.isFinite(status)) {
    return null;
  }
  return status;
}

function getServerMessageFromError(error) {
  const msg = typeof error?.message === "string" ? error.message : "";
  const bracketIdx = msg.indexOf("]");
  if (bracketIdx === -1) {
    return null;
  }
  const after = msg.slice(bracketIdx + 1).trim();
  return after || null;
}

export function friendlyErrorMessage(error, fallbackMessage) {
  if (isNetworkError(error)) {
    return "You seem to be offline. Check your connection and try again.";
  }

  if (isTimeoutError(error)) {
    return "This is taking longer than usual. Please try again.";
  }

  const status = getHttpStatusFromError(error);
  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }

  if (status === 429) {
    return "Too many requests right now. Wait a moment and try again.";
  }

  if (status && status >= 500) {
    return "The server is having trouble right now. Try again in a bit.";
  }

  // For common user-facing cases (403, 400), try to show the server message if present.
  if (status && status >= 400) {
    const serverMsg = getServerMessageFromError(error);
    if (serverMsg) {
      return serverMsg;
    }
  }

  const safeFallback =
    typeof fallbackMessage === "string" && fallbackMessage.trim()
      ? fallbackMessage.trim()
      : "Something went wrong.";

  return safeFallback;
}
