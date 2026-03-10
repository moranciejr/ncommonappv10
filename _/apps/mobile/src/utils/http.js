// Small HTTP helpers to make fetch + error handling more defensive.
// Goal: avoid crashes when the server returns non-JSON (HTML, empty body, etc.)

export async function readResponseBody(response) {
  if (!response) {
    return {};
  }

  const contentTypeRaw =
    typeof response.headers?.get === "function"
      ? response.headers.get("content-type")
      : "";
  const contentType = typeof contentTypeRaw === "string" ? contentTypeRaw : "";

  // If it says JSON, try JSON first.
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const json = await response.json();
      return json && typeof json === "object" ? json : {};
    } catch (_err) {
      // fall through to text
    }
  }

  // Otherwise, read text and (optionally) attempt to parse if it looks like JSON.
  let text = "";
  try {
    text = await response.text();
  } catch (_err) {
    return {};
  }

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return {};
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_err) {
      // fall back to raw text
    }
  }

  return { _rawText: trimmed };
}

export function getErrorMessageFromBody(body, response) {
  const fromJson =
    typeof body?.error === "string"
      ? body.error
      : typeof body?.message === "string"
        ? body.message
        : "";

  if (fromJson.trim()) {
    return fromJson.trim();
  }

  const raw = typeof body?._rawText === "string" ? body._rawText : "";
  if (raw) {
    // Don’t dump huge HTML into errors.
    const firstLine = raw.split("\n")[0] || raw;
    return firstLine.slice(0, 140);
  }

  const statusText =
    typeof response?.statusText === "string" ? response.statusText : "";
  return statusText || "Request failed";
}
