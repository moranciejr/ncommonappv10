import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import useUser from "@/utils/useUser";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function VerifyEmailRequiredPage() {
  const { data: user, loading } = useUser();
  const [sentOnce, setSentOnce] = useState(false);
  const [tokenEmailVerified, setTokenEmailVerified] = useState(false);
  const sentRef = useRef(false);

  const returnTo = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("returnTo");
    if (!raw) {
      return "/";
    }
    // Only allow in-app relative paths.
    if (raw.startsWith("/")) {
      return raw;
    }
    return "/";
  }, []);

  const requestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email-verification/request", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/email-verification/request, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: () => {
      setSentOnce(true);
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const checkMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/token");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/auth/token, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      const verified = !!data?.user?.emailVerified;
      setTokenEmailVerified(verified);
    },
    onError: (err) => {
      console.error(err);
    },
  });

  const emailVerified = !!user?.emailVerified || tokenEmailVerified;

  // Auto-send once for new signups (web flow).
  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      return;
    }
    if (emailVerified) {
      return;
    }
    if (sentRef.current) {
      return;
    }
    sentRef.current = true;
    requestMutation.mutate();
  }, [emailVerified, loading, requestMutation, user]);

  const devVerifyLink = requestMutation.data?.devVerifyLink;
  const providerFailed =
    requestMutation.data && requestMutation.data.emailSent === false;

  const statusText = useMemo(() => {
    if (loading) {
      return "Loading…";
    }
    if (!user) {
      return "Please sign in to verify your email.";
    }
    if (emailVerified) {
      return "Your email is verified.";
    }
    if (requestMutation.isPending) {
      return "Sending verification email…";
    }

    if (providerFailed) {
      return (
        requestMutation.data?.message ||
        "We couldn't send the verification email right now."
      );
    }

    if (sentOnce || requestMutation.data?.ok) {
      return "We sent a verification link to your email. Please check your inbox.";
    }
    return "Verify your email to continue.";
  }, [
    emailVerified,
    loading,
    providerFailed,
    requestMutation.data,
    requestMutation.isPending,
    sentOnce,
    user,
  ]);

  const showError = !!requestMutation.error;

  const onContinue = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.href = returnTo;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-col items-center">
          <img
            src={LOGO_URL}
            alt="nCommon"
            className="h-24 w-[360px] max-w-[85vw] object-contain"
          />
          <h1 className="mt-4 text-3xl font-semibold text-[#2D114D]">
            Verify your email
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            This helps keep nCommon safe and real.
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {statusText}
          {user?.email ? (
            <div className="mt-2 text-xs text-gray-500">
              Email: {user.email}
            </div>
          ) : null}

          {devVerifyLink ? (
            <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-700">
              <div className="font-semibold text-[#2D114D]">
                Dev verification link
              </div>
              <a
                href={devVerifyLink}
                className="mt-1 block break-all font-medium text-[#4A1D7E] hover:underline"
              >
                {devVerifyLink}
              </a>
            </div>
          ) : null}
        </div>

        {showError ? (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not send verification email. Please try again.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {!user ? (
            <a
              href="/account/signin"
              className="block w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-[#3B1763]"
            >
              Go to sign in
            </a>
          ) : null}

          {user && !emailVerified ? (
            <button
              type="button"
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763] disabled:opacity-60"
            >
              {requestMutation.isPending
                ? "Sending…"
                : "Resend verification email"}
            </button>
          ) : null}

          {user ? (
            <button
              type="button"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-[#2D114D] shadow-sm hover:bg-gray-50 disabled:opacity-60"
            >
              {checkMutation.isPending
                ? "Checking…"
                : "I verified — Check status"}
            </button>
          ) : null}

          {user && emailVerified ? (
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763]"
            >
              Continue
            </button>
          ) : null}

          {user ? (
            <a
              href="/account/logout"
              className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-base font-semibold text-[#2D114D] shadow-sm hover:bg-gray-50"
            >
              Sign out
            </a>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Tip: if you don’t see the email, check spam/junk.
        </p>
      </div>
    </div>
  );
}
