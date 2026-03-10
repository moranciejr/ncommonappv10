/**
 * Normalise whatever the user types into a valid ISO date string (YYYY-MM-DD).
 *
 * Accepted input formats (all case-insensitive, spaces/dashes/dots/slashes interchangeable):
 *   MM/DD/YYYY  MM-DD-YYYY  MM.DD.YYYY
 *   YYYY-MM-DD  YYYY/MM/DD  YYYY.MM.DD
 *   Month DD, YYYY   (e.g. "May 15, 1990")
 *   DD Month YYYY    (e.g. "15 May 1990")
 *   M/D/YYYY         (single-digit month/day)
 *
 * The parser is intentionally lenient so the user never gets stuck.
 */

const MONTH_NAMES = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseMonthName(str) {
  const lower = (str || "").toLowerCase().replace(/[.,]/g, "");
  return MONTH_NAMES[lower] || null;
}

export function parseDobToISODate(dobText) {
  const raw = typeof dobText === "string" ? dobText.trim() : "";
  if (!raw) {
    return { iso: "", error: "Date of birth is required." };
  }

  let year = null;
  let month = null;
  let day = null;

  // ── 1. ISO: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD ──
  const isoMatch = raw.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  }

  // ── 2. US: M/D/YYYY or MM-DD-YYYY or MM.DD.YYYY ──
  if (year === null) {
    const usMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (usMatch) {
      month = parseInt(usMatch[1], 10);
      day = parseInt(usMatch[2], 10);
      year = parseInt(usMatch[3], 10);
    }
  }

  // ── 3. US short year: M/D/YY (treat 00-30 as 2000s, 31-99 as 1900s) ──
  if (year === null) {
    const shortYearMatch = raw.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/,
    );
    if (shortYearMatch) {
      month = parseInt(shortYearMatch[1], 10);
      day = parseInt(shortYearMatch[2], 10);
      let shortYear = parseInt(shortYearMatch[3], 10);
      year = shortYear <= 30 ? 2000 + shortYear : 1900 + shortYear;
    }
  }

  // ── 4. "Month DD, YYYY" or "Month DD YYYY" ──
  if (year === null) {
    const namedMatch = raw.match(
      /^([a-zA-Z]+)[.,]?\s+(\d{1,2})[,.]?\s+(\d{4})$/,
    );
    if (namedMatch) {
      month = parseMonthName(namedMatch[1]);
      day = parseInt(namedMatch[2], 10);
      year = parseInt(namedMatch[3], 10);
    }
  }

  // ── 5. "DD Month YYYY" ──
  if (year === null) {
    const euroNamedMatch = raw.match(
      /^(\d{1,2})\s+([a-zA-Z]+)[.,]?\s+(\d{4})$/,
    );
    if (euroNamedMatch) {
      day = parseInt(euroNamedMatch[1], 10);
      month = parseMonthName(euroNamedMatch[2]);
      year = parseInt(euroNamedMatch[3], 10);
    }
  }

  // ── 6. MMDDYYYY (8 digits, no separators) ──
  if (year === null) {
    const digitsOnly = raw.replace(/\s/g, "");
    const eightDigits = digitsOnly.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (eightDigits) {
      month = parseInt(eightDigits[1], 10);
      day = parseInt(eightDigits[2], 10);
      year = parseInt(eightDigits[3], 10);
    }
  }

  // ── 7. YYYYMMDD (8 digits, ISO-compact) ──
  if (year === null) {
    const digitsOnly = raw.replace(/\s/g, "");
    const isoCompact = digitsOnly.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (isoCompact) {
      const potentialYear = parseInt(isoCompact[1], 10);
      // Only if it looks like a reasonable year
      if (potentialYear >= 1900 && potentialYear <= 2100) {
        year = potentialYear;
        month = parseInt(isoCompact[2], 10);
        day = parseInt(isoCompact[3], 10);
      }
    }
  }

  if (!year || !month || !day) {
    return {
      iso: "",
      error: "Enter your date of birth (e.g. 05/15/1990).",
    };
  }

  // Basic sanity
  if (month < 1 || month > 12) {
    return { iso: "", error: "Month must be between 1 and 12." };
  }
  if (day < 1 || day > 31) {
    return { iso: "", error: "Day must be between 1 and 31." };
  }
  if (year < 1900 || year > 2100) {
    return { iso: "", error: "Enter a valid year." };
  }

  // Construct as UTC date-only.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime())) {
    return { iso: "", error: "Enter a valid date of birth." };
  }

  // Reject impossible dates (e.g. 02/31)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { iso: "", error: "That date doesn't exist (e.g. Feb 30)." };
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (d.getTime() > todayUtc.getTime()) {
    return { iso: "", error: "DOB can't be in the future." };
  }

  const age = computeAgeFromDobISO(d.toISOString().slice(0, 10));
  if (age !== null && age < 18) {
    return { iso: "", error: "You must be 18+ to use nCommon." };
  }

  return { iso: d.toISOString().slice(0, 10), error: null };
}

/**
 * Convert an ISO date string (YYYY-MM-DD) to US display format (MM/DD/YYYY).
 * If the input is already in MM/DD/YYYY format, return it as-is.
 * Used when loading from the backend so the user sees a friendly format.
 */
export function isoToDisplayDate(isoOrDisplay) {
  const raw = typeof isoOrDisplay === "string" ? isoOrDisplay.trim() : "";
  if (!raw) return "";

  // Already in display format?
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) return raw;

  // ISO format?
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const mm = isoMatch[2];
    const dd = isoMatch[3];
    const yyyy = isoMatch[1];
    return `${mm}/${dd}/${yyyy}`;
  }

  // Something else — just return it so the parser can handle it on submit
  return raw;
}

export function computeAgeFromDobISO(isoDate) {
  if (typeof isoDate !== "string" || !isoDate) {
    return null;
  }
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);

  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth() + 1;
  const da = now.getUTCDate();

  let age = y - year;
  if (mo < month || (mo === month && da < day)) {
    age -= 1;
  }
  if (!Number.isFinite(age) || age < 0 || age > 130) {
    return null;
  }
  return age;
}

export function clampText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLen) {
    return value;
  }
  return value.slice(0, maxLen);
}
