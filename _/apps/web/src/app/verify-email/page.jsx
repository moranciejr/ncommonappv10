import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function VerifyEmailPage() {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState({
    state: "loading",
    message: "Verifying your email…",
  });

  const tokenFromUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
  }, []);

  useEffect(() => {
    setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  const verifyMutation = useMutation({
    mutationFn: async ({ token }) => {
      const response = await fetch("/api/email-verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/email-verification/confirm, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: () => {
      setStatus({
        state: "success",
        message: "Email verified. You can go back to the app.",
      });
    },
    onError: (err) => {
      console.error(err);
      setStatus({
        state: "error",
        message: "That verification link is invalid or expired.",
      });
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus({ state: "error", message: "Missing verification token." });
      return;
    }
    verifyMutation.mutate({ token });
  }, [token, verifyMutation]);

  const isError = status.state === "error";
  const boxClass = isError
    ? "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
    : "rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800";

  const showBox = status.state !== "loading";

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
            Verify email
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            We’re confirming your email address.
          </p>
        </div>

        {status.state === "loading" ? (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {status.message}
          </div>
        ) : null}

        {showBox ? <div className={boxClass}>{status.message}</div> : null}

        <div className="mt-6 text-center text-sm">
          <a
            href="/account/signin"
            className="font-medium text-[#4A1D7E] hover:underline"
          >
            Go to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
