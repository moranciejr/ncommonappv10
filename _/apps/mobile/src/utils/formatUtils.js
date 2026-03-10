export function formatWhenShort(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function clampNum(value, { min, max, fallback }) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, n));
}

export function colorForInterest(interest) {
  const s = String(interest || "");
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  // Pastel-ish HSL
  const hue = hash % 360;
  const sat = 70;
  const light = 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
