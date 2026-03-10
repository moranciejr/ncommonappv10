export function clampText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLen) {
    return value;
  }
  return value.slice(0, maxLen);
}
