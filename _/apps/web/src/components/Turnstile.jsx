import { useEffect, useMemo, useRef, useState } from "react";

function ensureTurnstileScriptLoaded() {
  if (typeof window === "undefined") {
    return;
  }

  const existing = document.getElementById("cf-turnstile-script");
  if (existing) {
    return;
  }

  const script = document.createElement("script");
  script.id = "cf-turnstile-script";
  script.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

export default function Turnstile({ siteKey, onToken, theme = "light" }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [loadError, setLoadError] = useState(null);

  const resolvedTheme = useMemo(() => {
    return theme === "dark" ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    ensureTurnstileScriptLoaded();
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }
    if (!containerRef.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const tryRender = () => {
      if (cancelled) {
        return;
      }
      if (widgetIdRef.current) {
        return;
      }
      const ts = window.turnstile;
      if (!ts || typeof ts.render !== "function") {
        return;
      }

      try {
        widgetIdRef.current = ts.render(containerRef.current, {
          sitekey: siteKey,
          theme: resolvedTheme,
          callback: (token) => {
            if (typeof onToken === "function") {
              onToken(token);
            }
          },
          "expired-callback": () => {
            if (typeof onToken === "function") {
              onToken(null);
            }
          },
          "error-callback": () => {
            if (typeof onToken === "function") {
              onToken(null);
            }
            setLoadError("Security check failed to load. Please refresh.");
          },
        });
      } catch (err) {
        console.error(err);
        setLoadError("Security check failed to load. Please refresh.");
      }
    };

    tryRender();
    const interval = setInterval(tryRender, 250);

    return () => {
      cancelled = true;
      clearInterval(interval);

      try {
        const ts = window.turnstile;
        if (ts && typeof ts.remove === "function" && widgetIdRef.current) {
          ts.remove(widgetIdRef.current);
        }
      } catch (err) {
        console.error(err);
      }

      widgetIdRef.current = null;
    };
  }, [onToken, resolvedTheme, siteKey]);

  if (!siteKey) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
        Bot protection is not configured.
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} />
      {loadError ? (
        <div className="mt-2 text-xs text-red-600">{loadError}</div>
      ) : null}
    </div>
  );
}
