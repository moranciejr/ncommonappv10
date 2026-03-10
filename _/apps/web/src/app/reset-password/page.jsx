import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const LOGO_URL =
  "https://ucarecdn.com/6d1cb8d8-e9db-44f9-bf57-284e5bf3092c/-/format/auto/";

export default function ResetPasswordPage() {
  const [token, setToken] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(null);

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

  const resetMutation = useMutation({
    mutationFn: async ({ token, password }) => {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/password-reset/confirm, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: () => {
      setStatus({
        type: "success",
        message: "Password updated. You can sign in now.",
      });
    },
    onError: (err) => {
      console.error(err);
      setStatus({
        type: "error",
        message:
          "That reset link is invalid or expired. Please request a new one.",
      });
    },
  });

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setStatus(null);

      if (!token) {
        setStatus({ type: "error", message: "Missing reset token." });
        return;
      }

      if (!password || password.length < 6) {
        setStatus({
          type: "error",
          message: "Password must be at least 6 characters.",
        });
        return;
      }

      if (password !== confirmPassword) {
        setStatus({ type: "error", message: "Passwords do not match." });
        return;
      }

      resetMutation.mutate({ token, password });
    },
    [token, password, confirmPassword, resetMutation],
  );

  const isLoading = resetMutation.isPending;

  const StatusBlock = () => {
    if (!status) {
      return null;
    }

    const isError = status.type === "error";
    const className = isError
      ? "rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
      : "rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800";

    return <div className={className}>{status.message}</div>;
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
            Set a new password
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Choose a new password for your account.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-[#4A1D7E] focus:ring-2 focus:ring-[#4A1D7E]/15"
              placeholder="6+ characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-[#4A1D7E] focus:ring-2 focus:ring-[#4A1D7E]/15"
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>

          <StatusBlock />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[#4A1D7E] px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#3B1763] disabled:opacity-60"
          >
            {isLoading ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <a
            href="/account/signin"
            className="font-medium text-[#4A1D7E] hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
