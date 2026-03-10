export function parseId(value) {
  // expo-router params can be string | string[] | undefined.
  const first = Array.isArray(value) ? value[0] : value;

  const n =
    typeof first === "number" ? first : parseInt(String(first || ""), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

export function formatTime(ts) {
  if (!ts) {
    return "";
  }
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
