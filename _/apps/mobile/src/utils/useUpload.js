import * as React from "react";
import * as ImageManipulator from "expo-image-manipulator";
import authedFetch from "@/utils/authedFetch";

function useUpload() {
  const [loading, setLoading] = React.useState(false);

  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);

      // Mobile: try our app route first (auth-gated, stable), then fall back to Anything's built-in.
      // Note: /_create routes can be inconsistent depending on the Expo proxy.
      const endpoints = ["/api/upload", "/_create/api/upload/"];

      const tryUploadJson = async (endpoint, payload) => {
        const response = await authedFetch(endpoint, {
          method: "POST",
          timeoutMs: 45000, // Increased from 30s to 45s
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const status = response.status;
        const statusText = response.statusText;

        if (response.ok) {
          const dataOk = await response.json().catch(() => ({}));
          return { ok: true, data: dataOk, response };
        }

        const dataErr = await response.json().catch(() => null);
        const rawMsg = dataErr?.error || dataErr?.message || null;

        const fallbackMsg = `Upload failed via ${endpoint} (${status} ${statusText})`;
        const msg = rawMsg
          ? `${rawMsg} (via ${endpoint}, ${status} ${statusText})`
          : fallbackMsg;

        return {
          ok: false,
          response,
          message: msg,
          data: dataErr,
        };
      };

      let payload;

      if ("reactNativeAsset" in input && input.reactNativeAsset) {
        const asset = input.reactNativeAsset;

        if (!asset?.uri) {
          throw new Error("No photo URI found.");
        }

        let result;
        try {
          // More aggressive compression to prevent network failures
          // Resize to 400px (down from 512px) and compress to 0.5 (down from 0.6)
          result = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 400 } }],
            {
              compress: 0.5,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          );
        } catch (err) {
          console.error("Image manipulation failed", err);
          throw new Error(
            "Could not process that photo. Please try a different one (or take a screenshot and try that).",
          );
        }

        const base64Raw = result?.base64;
        if (!base64Raw) {
          throw new Error(
            "Could not read that photo for upload. Please try a different image.",
          );
        }

        // Log the size for debugging
        const sizeKB = Math.round(base64Raw.length / 1024);
        console.log(`Upload payload size: ${sizeKB}KB`);

        // Add a size check before trying to upload
        if (base64Raw.length > 3_500_000) {
          throw new Error(
            `Photo is too large (${sizeKB}KB). Please try a smaller photo or take a screenshot.`,
          );
        }

        payload = {
          base64: `data:image/jpeg;base64,${base64Raw}`,
        };
      } else if ("url" in input) {
        payload = { url: input.url };
      } else if ("base64" in input) {
        payload = { base64: input.base64 };
      } else {
        throw new Error(
          "Unsupported upload input. Please provide a photo, url, or base64.",
        );
      }

      const errors = [];

      for (const endpoint of endpoints) {
        try {
          const attempt = await tryUploadJson(endpoint, payload);

          if (attempt.ok) {
            const data = attempt.data || {};
            if (!data?.url) {
              throw new Error("Upload failed: no URL returned.");
            }
            return { url: data.url, mimeType: data.mimeType || null };
          }

          const status = attempt.response?.status;
          if (status === 413) {
            return { error: "Photo is too large. Please try a smaller photo." };
          }

          errors.push(attempt.message);
          console.error("Upload attempt failed", {
            endpoint,
            status,
            message: attempt.message,
            data: attempt.data,
          });
        } catch (networkError) {
          // Handle network timeouts and failures more gracefully
          const errorMsg =
            networkError instanceof Error
              ? networkError.message
              : String(networkError);

          if (errorMsg.includes("timeout") || errorMsg.includes("timed out")) {
            errors.push(
              `Upload timed out (${endpoint}). Photo may be too large or connection is slow.`,
            );
          } else if (errorMsg.includes("Network request failed")) {
            errors.push(
              `Network error (${endpoint}). Check your internet connection.`,
            );
          } else {
            errors.push(`Upload failed (${endpoint}): ${errorMsg}`);
          }

          console.error("Network error during upload", {
            endpoint,
            error: networkError,
          });
        }
      }

      // If both endpoints fail, show a helpful combined message
      if (errors.length > 0) {
        const hasTimeout = errors.some(
          (e) => e.includes("timeout") || e.includes("timed out"),
        );
        const hasNetwork = errors.some((e) => e.includes("Network"));

        if (hasTimeout) {
          return {
            error:
              "Upload timed out. Please try a smaller photo or check your internet connection.",
          };
        }
        if (hasNetwork) {
          return {
            error:
              "Network error. Please check your internet connection and try again.",
          };
        }

        // Show first error if we have specific errors
        return { error: errors[0] || "Upload failed" };
      }

      return { error: "Upload failed. Please try again." };
    } catch (uploadError) {
      console.error("Upload error", uploadError);

      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;
