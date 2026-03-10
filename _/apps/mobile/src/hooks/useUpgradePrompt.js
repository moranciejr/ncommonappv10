import { useState, useRef } from "react";

export function useUpgradePrompt() {
  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const lastPromptReasonRef = useRef(null);

  const showUpgradePrompt = (nudge) => {
    const reason = typeof nudge?.reason === "string" ? nudge.reason : "";
    if (!reason || lastPromptReasonRef.current !== reason) {
      lastPromptReasonRef.current = reason || "_shown";
      setUpgradePrompt(nudge);
    }
  };

  const handleCreateSuccess = (data, savedDefaults) => {
    const nudge = data?.upgradeNudge;
    if (nudge?.reason && lastPromptReasonRef.current !== nudge.reason) {
      lastPromptReasonRef.current = nudge.reason;
      setUpgradePrompt(nudge);
    } else {
      setUpgradePrompt(null);
    }
  };

  const handleCreateError = (err) => {
    if (err?.code === "VERIFY_REQUIRED") {
      const nudge = err?.payload?.verifyNudge;
      showUpgradePrompt(
        nudge || {
          title: "Verify your email",
          message: "Please verify your email to continue.",
          primaryCta: "Verify email",
          secondaryCta: "Not now",
          target: "/verify-email",
          reason: "email_verification_required",
        },
      );
      return true;
    }

    if (err?.code === "UPGRADE_REQUIRED") {
      const nudge = err?.payload?.upgradeNudge;
      showUpgradePrompt(
        nudge || {
          title: "Upgrade",
          message: "Upgrade to continue.",
          primaryCta: "Upgrade",
          secondaryCta: "Not now",
          target: "/upgrade",
          reason: "upgrade_required",
        },
      );
      return true;
    }

    return false;
  };

  return {
    upgradePrompt,
    setUpgradePrompt,
    handleCreateSuccess,
    handleCreateError,
  };
}
