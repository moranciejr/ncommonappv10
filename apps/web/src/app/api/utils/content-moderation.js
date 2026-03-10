/**
 * Content Moderation Utilities
 * Filters objectionable material from user-generated content
 */

// Common profanity and inappropriate terms (basic list - expand as needed)
const PROFANITY_LIST = [
  "fuck",
  "shit",
  "bitch",
  "ass",
  "damn",
  "crap",
  "piss",
  "dick",
  "cock",
  "pussy",
  "fag",
  "slut",
  "whore",
  "bastard",
  "cunt",
  "nigger",
  "nigga",
];

// Patterns that might indicate inappropriate content
const SUSPICIOUS_PATTERNS = [
  /\b(sex|porn|xxx|nude|naked)\b/i,
  // Specific hard drugs only — "drug" and "weed" are too broad (e.g. "drugstore", "speed run")
  /\b(cocaine|heroin|meth|fentanyl|crack\s+cocaine)\b/i,
  // Targeted threats only — single words like "die" block "I'm dying of laughter", "die hard"
  /\b(kill\s+(you|yourself|me|us|them)|going\s+to\s+kill|i.ll\s+kill|want\s+to\s+die|kill\s+myself|shoot\s+(you|myself))\b/i,
  /\b(nazi|white\s+power|white\s+supremac)\b/i,
  /\b(scam|fraud|money\s*transfer|wire\s*transfer)\b/i,
  /(https?:\/\/[^\s]+)/gi, // URLs (might be spam)
  /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g, // Phone numbers
  /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, // Email addresses
];

/**
 * Check if text contains profanity
 */
function containsProfanity(text) {
  if (!text || typeof text !== "string") return false;

  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(lowerText);
  });
}

/**
 * Check if text matches suspicious patterns
 */
function matchesSuspiciousPatterns(text) {
  if (!text || typeof text !== "string") return false;

  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Filter profanity from text by replacing with asterisks
 */
function filterProfanity(text) {
  if (!text || typeof text !== "string") return text;

  let filtered = text;
  PROFANITY_LIST.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    filtered = filtered.replace(regex, "*".repeat(word.length));
  });

  return filtered;
}

/**
 * Moderate user-generated content
 * Returns { allowed: boolean, filtered: string, reason?: string }
 */
export function moderateContent(text, options = {}) {
  const {
    allowUrls = false,
    allowContactInfo = false,
    filterProfanityOnly = false,
  } = options;

  if (!text || typeof text !== "string") {
    return { allowed: true, filtered: text };
  }

  // Check for profanity
  if (containsProfanity(text)) {
    if (filterProfanityOnly) {
      return {
        allowed: true,
        filtered: filterProfanity(text),
        reason: "profanity_filtered",
      };
    }
    return {
      allowed: false,
      filtered: text,
      reason: "profanity_detected",
    };
  }

  // Check for suspicious patterns
  if (matchesSuspiciousPatterns(text)) {
    // Check specific patterns based on options
    if (!allowUrls && /(https?:\/\/[^\s]+)/gi.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "urls_not_allowed",
      };
    }

    if (!allowContactInfo) {
      if (/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g.test(text)) {
        return {
          allowed: false,
          filtered: text,
          reason: "phone_number_detected",
        };
      }
      if (/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi.test(text)) {
        return {
          allowed: false,
          filtered: text,
          reason: "email_detected",
        };
      }
    }

    // Check for other inappropriate content
    if (/\b(sex|porn|xxx|nude|naked)\b/i.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "sexual_content",
      };
    }

    if (/\b(cocaine|heroin|meth|fentanyl|crack\s+cocaine)\b/i.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "drug_reference",
      };
    }

    if (/\b(kill\s+(you|yourself|me|us|them)|going\s+to\s+kill|i.ll\s+kill|want\s+to\s+die|kill\s+myself|shoot\s+(you|myself))\b/i.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "violent_content",
      };
    }

    if (/\b(nazi|white\s+power|white\s+supremac)\b/i.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "hate_speech",
      };
    }

    if (/\b(scam|fraud|money\s*transfer)\b/i.test(text)) {
      return {
        allowed: false,
        filtered: text,
        reason: "potential_scam",
      };
    }
  }

  return { allowed: true, filtered: text };
}

/**
 * Moderate multiple fields in an object
 */
export function moderateFields(data, fields, options = {}) {
  const results = {};
  let allAllowed = true;
  const reasons = [];

  for (const field of fields) {
    if (data[field]) {
      const result = moderateContent(data[field], options);
      results[field] = result;

      if (!result.allowed) {
        allAllowed = false;
        reasons.push(`${field}: ${result.reason}`);
      }
    }
  }

  return {
    allowed: allAllowed,
    results,
    reasons,
  };
}

/**
 * Log moderation event for review
 */
export async function logModerationEvent(userId, contentType, content, reason) {
  try {
    const sql = (await import("./sql.js")).default;

    await sql`
      INSERT INTO moderation_logs (user_id, content_type, content, reason, created_at)
      VALUES (${userId}, ${contentType}, ${content}, ${reason}, NOW())
    `;
  } catch (error) {
    console.error("Error logging moderation event:", error);
  }
}
