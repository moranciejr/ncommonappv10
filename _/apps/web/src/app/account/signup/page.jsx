import { useCallback, useMemo, useState } from "react";
import useAuth from "@/utils/useAuth";
import Turnstile from "@/components/Turnstile";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function SignUpPage() {
  const { signUpWithCredentials, signInWithGoogle } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.search || "";
  }, []);

  // IMPORTANT: Mobile auth depends on the callbackUrl query param.
  const callbackUrlFromSearch = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("callbackUrl");
    return raw && typeof raw === "string" ? raw : null;
  }, []);

  // If the user is signing up from the Expo app (WebView), Turnstile can be flaky
  // in some in-app browsers. We still keep Turnstile for normal web signups.
  const isMobileAuthFlow = useMemo(() => {
    return (
      !!callbackUrlFromSearch && callbackUrlFromSearch.startsWith("/api/auth/")
    );
  }, [callbackUrlFromSearch]);

  // Also treat mobile browsers similarly: Turnstile can spin forever for some mobile setups.
  const isMobileBrowser = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }, []);

  // Cloudflare Turnstile (bot protection)
  const shouldUseTurnstile = !isMobileAuthFlow && !isMobileBrowser;
  const turnstileSiteKey =
    shouldUseTurnstile && typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;
  const [turnstileToken, setTurnstileToken] = useState(null);

  const computedCallbackUrl = useMemo(() => {
    // If a callbackUrl is present (e.g. mobile uses /api/auth/*), never override it.
    if (callbackUrlFromSearch) {
      const isAuthTokenCallback =
        callbackUrlFromSearch.startsWith("/api/auth/");
      if (isAuthTokenCallback) {
        return callbackUrlFromSearch;
      }
      return `/verify-email-required?returnTo=${encodeURIComponent(callbackUrlFromSearch)}`;
    }

    // Default web signup: after creating an account, ask them to verify email.
    return `/verify-email-required?returnTo=${encodeURIComponent("/")}`;
  }, [callbackUrlFromSearch]);

  const verifyTurnstile = useCallback(async () => {
    // For mobile auth flows and mobile browsers, don't block sign up on Turnstile (it can hang).
    if (!shouldUseTurnstile) {
      return true;
    }

    // If Turnstile isn't configured, don't block local development.
    if (!turnstileSiteKey) {
      return true;
    }

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return false;
    }

    const response = await fetch("/api/security/turnstile/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || response.statusText;
      throw new Error(
        `When fetching /api/security/turnstile/verify, the response was [${response.status}] ${msg}`,
      );
    }

    if (!data?.success) {
      setError("We couldn't verify you're human. Please try again.");
      return false;
    }

    return true;
  }, [shouldUseTurnstile, turnstileSiteKey, turnstileToken]);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      if (!email || !password) {
        setError("Please enter your email and password.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      try {
        const ok = await verifyTurnstile();
        if (!ok) {
          setLoading(false);
          return;
        }

        await signUpWithCredentials({
          email,
          password,
          name,
          callbackUrl: computedCallbackUrl,
          redirect: true,
        });
      } catch (err) {
        console.error(err);
        setError("Could not create your account. Try another email.");
        setLoading(false);
      }
    },
    [
      email,
      password,
      name,
      signUpWithCredentials,
      computedCallbackUrl,
      verifyTurnstile,
    ],
  );

  const onGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await verifyTurnstile();
      if (!ok) {
        setLoading(false);
        return;
      }

      await signInWithGoogle({
        callbackUrl: computedCallbackUrl,
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      setError("Google sign-up failed. Please try again.");
      setLoading(false);
    }
  }, [signInWithGoogle, computedCallbackUrl, verifyTurnstile]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={LOGO_URL}
            alt="nCommon"
            className="h-48 w-[720px] max-w-[85vw] object-contain"
          />
          <h1 className="mt-1 text-3xl font-semibold text-[#2D114D]">
            Create account
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            You’re one step away from meeting your people.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <div className="text-xs text-gray-500">or</div>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-[#4A1D7E] focus:ring-2 focus:ring-[#4A1D7E]/15"
              placeholder="Michael"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-[#4A1D7E] focus:ring-2 focus:ring-[#4A1D7E]/15"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-[#4A1D7E] focus:ring-2 focus:ring-[#4A1D7E]/15"
              placeholder="Create a password"
              autoComplete="new-password"
            />
            <p className="mt-2 text-xs text-gray-500">
              Use 6+ characters. You can reset it later.
            </p>
          </div>

          {/* Bot protection (Turnstile) - hidden for embedded mobile auth + mobile browsers */}
          {shouldUseTurnstile ? (
            <Turnstile
              siteKey={turnstileSiteKey}
              onToken={(token) => setTurnstileToken(token)}
            />
          ) : null}

          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763] disabled:opacity-60"
          >
            {loading ? "Creating…" : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <a
            href={`/account/signin${search}`}
            className="font-medium text-[#4A1D7E] hover:underline"
          >
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
