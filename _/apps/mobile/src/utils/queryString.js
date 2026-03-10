// Small helper to build query strings safely in React Native.
// Some JS runtimes (or older Hermes builds) can be flaky with URLSearchParams,
// so we keep a tiny encoder here.

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  // fallback
  const s = String(value);
  return s ? s : null;
}

export function buildQueryString(params) {
  if (!params || typeof params !== "object") {
    return "";
  }

  const parts = [];
  for (const [key, raw] of Object.entries(params)) {
    const k = typeof key === "string" ? key.trim() : "";
    if (!k) {
      continue;
    }

    const v = normalizeValue(raw);
    if (v === null) {
      continue;
    }

    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  return parts.join("&");
}

export function withQuery(path, params) {
  const base = typeof path === "string" ? path : "";
  const qs = buildQueryString(params);
  if (!qs) {
    return base;
  }
  return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
}
