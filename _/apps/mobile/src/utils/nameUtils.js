export function initialsFromName(name) {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) {
    return "?";
  }
  const parts = safe.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1] || "";
  const joined = `${first}${second}`.toUpperCase();
  return joined || "?";
}
