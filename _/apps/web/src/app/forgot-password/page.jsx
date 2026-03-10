import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  const search = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.location.search || "";
  }, []);

  const requestMutation = useMutation({
    mutationFn: async ({ email }) => {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error(
          `When fetching /api/password-reset/request, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    onSuccess: (data) => {
      const devLink = data?.devResetLink;
      const message =
        "If that email exists, we sent a reset link. Check your inbox.";
      setStatus({ type: "success", message, devLink });
    },
    onError: (err) => {
      console.error(err);
      setStatus({
        type: "error",
        message: "Could not request a reset link. Please try again.",
      });
    },
  });

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setStatus(null);
      if (!email) {
        setStatus({ type: "error", message: "Please enter your email." });
        return;
      }
      requestMutation.mutate({ email });
    },
    [email, requestMutation],
  );

  const isLoading = requestMutation.isPending;

  const StatusBlock = () => {
    if (!status) {
      return null;
    }

    const isError = status.type === "error";
    const className = isError
      ? "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
      : "rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800";

    return (
      <div className="space-y-2">
        <div className={className}>{status.message}</div>
        {status.devLink ? (
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-700">
            Dev-only reset link:{" "}
            <a className="underline" href={status.devLink}>
              {status.devLink}
            </a>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <img
            src={LOGO_URL}
            alt="nCommon"
            className="h-24 w-[360px] max-w-[85vw] object-contain"
          />
          <h1 className="mt-4 text-3xl font-semibold text-[#2D114D]">
            Reset your password
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            We’ll email you a link to set a new password.
          </p>
          <p className="mt-2 text-center text-xs text-gray-500">
            If you’re the app owner and emails aren’t arriving, set up the
            Resend integration (RESEND_API_KEY) in Project Settings.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

          <StatusBlock />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763] disabled:opacity-60"
          >
            {isLoading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <a
            href={`/account/signin${search}`}
            className="font-medium text-[#4A1D7E] hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
