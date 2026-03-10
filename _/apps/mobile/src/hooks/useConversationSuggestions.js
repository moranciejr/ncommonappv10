import { useMemo } from "react";
import { getInterestLabel } from "@/utils/interestTaxonomy";

export function useConversationSuggestions({
  contextType,
  contextInterest,
  contextLocationName,
  contextEventTitle,
  ncommonChips = [],
  otherName,
  messages = [],
  isLoading = false,
  // NEW: suggestion tone (kept simple so UI stays clean)
  tone = "chill", // chill | funny | direct
}) {
  const contextInterestLabel = useMemo(() => {
    if (!contextInterest) {
      return null;
    }
    return getInterestLabel(contextInterest) || contextInterest;
  }, [contextInterest]);

  const normalizedTone = useMemo(() => {
    const t = typeof tone === "string" ? tone.trim().toLowerCase() : "";
    if (t === "funny" || t === "direct") {
      return t;
    }
    return "chill";
  }, [tone]);

  const quickStarters = useMemo(() => {
    const safeNcommon = Array.isArray(ncommonChips) ? ncommonChips : [];
    const name = otherName && otherName !== "Chat" ? otherName : "there";

    const interestText = contextInterestLabel ? contextInterestLabel : "this";
    const locationText = contextLocationName ? contextLocationName : null;

    const sharedInterest = safeNcommon.length ? safeNcommon[0] : null;

    const items = [];

    if (contextType === "event") {
      const title = contextEventTitle || "your event";

      if (normalizedTone === "direct") {
        items.push(`Hey ${name} — can I join ${title}?`);
        items.push("Are you still open to one more?");
        if (locationText) {
          items.push(`Is it at ${locationText}?`);
        }
        items.push("What time should I come by?");
      } else if (normalizedTone === "funny") {
        items.push(`Hey ${name} — I come in peace. Can I join ${title}?`);
        items.push("No stress if you're full — just shooting my shot.");
        if (sharedInterest) {
          items.push(`Also — ${sharedInterest} gang. Respect.`);
        }
        items.push("What's the vibe — chill or more social?");
      } else {
        // chill (default)
        items.push(
          `Hey ${name}! I saw ${title} — are you still open to one more?`,
        );
        items.push("No pressure at all — just figured I'd ask.");

        if (sharedInterest) {
          items.push(
            `Also — we both like ${sharedInterest}. Thought that was cool.`,
          );
        }

        if (locationText) {
          items.push(`Quick question — is it at ${locationText}?`);
        }

        items.push("What's the vibe like — chill or more social?");
      }

      // De-dupe while keeping order
      const deduped = [];
      for (const t of items) {
        if (!deduped.includes(t)) {
          deduped.push(t);
        }
      }

      return deduped.slice(0, 6);
    }

    // plan (default)
    if (normalizedTone === "direct") {
      items.push(`Hey ${name} — mind if I join?`);
      if (contextInterestLabel) {
        items.push(`I’m down for ${interestText}.`);
      }
      items.push("Still open to one more?");
      if (locationText) {
        items.push(`Where should I meet you at ${locationText}?`);
      } else {
        items.push("Where should I meet you?");
      }
    } else if (normalizedTone === "funny") {
      items.push(`Hey ${name} — is there room for one more human?`);
      if (contextInterestLabel) {
        items.push(`Your ${interestText} plan looks fun. I’m tempted.`);
      }
      items.push("No stress if you're full — figured I’d ask.");
      if (sharedInterest) {
        items.push(
          `Also — we both like ${sharedInterest}. That’s a green flag.`,
        );
      }
      if (locationText) {
        items.push(`Are you around ${locationText} right now?`);
      }
    } else {
      // chill (default)
      items.push(`Hey ${name}! Mind if I join?`);

      if (contextInterestLabel) {
        items.push(`I saw your ${interestText} plan — looks fun.`);
      }

      items.push("No stress if you're full — figured I'd ask.");

      if (sharedInterest) {
        items.push(
          `Also — we both like ${sharedInterest}. Thought that was cool.`,
        );
      }

      if (locationText) {
        items.push(`Are you around ${locationText} right now?`);
      }
    }

    // De-dupe while keeping order
    const deduped = [];
    for (const t of items) {
      if (!deduped.includes(t)) {
        deduped.push(t);
      }
    }

    return deduped.slice(0, 6);
  }, [
    contextEventTitle,
    contextInterestLabel,
    contextLocationName,
    contextType,
    ncommonChips,
    otherName,
    normalizedTone,
  ]);

  const icebreakers = useMemo(() => {
    const safeNcommon = Array.isArray(ncommonChips) ? ncommonChips : [];
    const interestText = contextInterestLabel ? contextInterestLabel : null;
    const locationText = contextLocationName ? contextLocationName : null;
    const sharedInterest = safeNcommon.length ? safeNcommon[0] : null;

    const items = [];

    // These are meant to feel "cool": short, friendly, low-pressure.
    // We vary slightly by tone, but keep it simple.

    if (normalizedTone === "direct") {
      if (locationText) {
        items.push(`Where should I meet you at ${locationText}?`);
      } else {
        items.push("Where should I meet you?");
      }
      items.push("What time are you thinking?");
      items.push("How big is the group right now?");
      items.push("Any details I should know? (parking, what to bring)");
      if (sharedInterest) {
        items.push(
          `We both like ${sharedInterest} — how long have you been into it?`,
        );
      }
    } else if (normalizedTone === "funny") {
      if (sharedInterest) {
        items.push(`Random but: what got you into ${sharedInterest}?`);
      }
      items.push("Quick vibe check: are we chatting or actually meeting up?");
      items.push("Are we doing 'start on time' or 'Austin time'?");
      if (locationText) {
        items.push(`Where's the "I’m here" spot at ${locationText}?`);
      } else {
        items.push("Where's the 'I’m here' spot?");
      }
      if (contextType === "event") {
        items.push("Do people usually come solo or with friends?");
      } else if (interestText) {
        items.push(`Is ${interestText} more "chill" or "competitive"?`);
      }
    } else {
      // chill (default)
      if (sharedInterest) {
        items.push(`Random but: what got you into ${sharedInterest}?`);
      }

      items.push("Quick vibe check: is this chill or more social?");

      if (locationText) {
        items.push(`Where should I meet you at ${locationText}?`);
      } else {
        items.push("Where should I meet you when I get there?");
      }

      items.push("Are we doing 'start on time' or 'show up whenever'?");

      if (contextType === "event") {
        items.push("Is it cool if I come solo?");
        items.push("What's the best time to roll through?");
      } else {
        if (interestText) {
          items.push(`Are we keeping ${interestText} pretty casual?`);
        }
        items.push("If not today, all good — when do you usually do this?");
      }
    }

    // De-dupe while keeping order
    const deduped = [];
    for (const t of items) {
      const next = typeof t === "string" ? t.trim() : "";
      if (!next) {
        continue;
      }
      if (!deduped.includes(next)) {
        deduped.push(next);
      }
    }

    return deduped.slice(0, 12);
  }, [
    contextInterestLabel,
    contextLocationName,
    contextType,
    ncommonChips,
    normalizedTone,
  ]);

  const shouldShowQuickStarters = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    return !isLoading && safeMessages.length === 0 && quickStarters.length > 0;
  }, [messages, isLoading, quickStarters.length]);

  const shouldShowIcebreakers = useMemo(() => {
    const safeMessages = Array.isArray(messages) ? messages : [];
    return !isLoading && safeMessages.length === 0 && icebreakers.length > 0;
  }, [icebreakers.length, messages, isLoading]);

  return {
    contextInterestLabel,
    quickStarters,
    icebreakers,
    shouldShowQuickStarters,
    shouldShowIcebreakers,
    // NEW: surface the normalized tone so the UI can reflect it
    tone: normalizedTone,
  };
}
