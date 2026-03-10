import { useCallback } from "react";
import * as RNImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

export function useImagePicker({
  setError,
  setAvatarUrl,
  setAvatarPreviewUri,
  setPickedAsset,
  setPickedPreviewNonce,
  upload,
}) {
  const pickImage = useCallback(async () => {
    setError(null);

    // IMPORTANT: do NOT clear avatarUrl here.
    // If the user already had a saved avatar and the new upload fails,
    // clearing avatarUrl would make them lose their existing photo on Finish.
    // We only clear the preview so the UI doesn't keep showing a stale bitmap.
    setAvatarPreviewUri("");

    // Request permission explicitly (some devices won't open the picker cleanly without this).
    try {
      const perm = await RNImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Please allow photo access to pick a profile photo.");
        return;
      }
    } catch (err) {
      console.error(err);
      // If permission API isn't available for some reason, still try to open picker.
    }

    const result = await RNImagePicker.launchImageLibraryAsync({
      mediaTypes: RNImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled) {
      return;
    }

    // expo-image-picker returns `assets` in modern versions, but some environments can differ.
    const asset = result.assets?.[0] || result;
    if (!asset || !asset.uri) {
      setError("Could not read that photo. Please try a different one.");
      return;
    }

    // On iOS, some photo URIs can be non-file URIs. Create a local preview file URI.
    let nextAsset = asset;
    let previewUri = asset.uri;
    try {
      const manipulate =
        ImageManipulator.manipulateAsync || ImageManipulator.manipulateImage;

      if (typeof manipulate === "function") {
        const preview = await manipulate(
          asset.uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );

        const nextUri = preview?.uri;
        if (nextUri) {
          previewUri = nextUri;
          nextAsset = { ...asset, uri: nextUri };
        }
      }
    } catch (err) {
      console.error("Preview processing failed", err);
      nextAsset = asset;
      previewUri = asset.uri;
    }

    // Cache-bust the preview URI so expo-image can't reuse a stale bitmap.
    const previewBusted = previewUri
      ? `${previewUri}${previewUri.includes("?") ? "&" : "?"}t=${Date.now()}`
      : "";

    // Show the picked image immediately.
    setPickedAsset(nextAsset);
    setAvatarPreviewUri(previewBusted);
    setPickedPreviewNonce((n) => n + 1);

    // Auto-upload right after picking (one tap flow).
    const { url, error: uploadError } = await upload({
      reactNativeAsset: nextAsset,
    });

    if (uploadError) {
      console.error("Avatar upload failed", uploadError);
      setError(uploadError || "Could not upload photo. Please try again.");
      // Keep pickedAsset so the user can tap "Retry upload".
      return;
    }

    const uploadedUrl = url || "";
    setAvatarUrl(uploadedUrl);
    setAvatarPreviewUri(
      uploadedUrl
        ? `${uploadedUrl}${uploadedUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
        : "",
    );

    setPickedAsset(null);
  }, [
    upload,
    setError,
    setAvatarUrl,
    setAvatarPreviewUri,
    setPickedAsset,
    setPickedPreviewNonce,
  ]);

  const uploadAvatar = useCallback(
    async (pickedAsset) => {
      if (!pickedAsset) {
        return;
      }
      setError(null);

      const { url, error: uploadError } = await upload({
        reactNativeAsset: pickedAsset,
      });

      if (uploadError) {
        console.error("Avatar upload failed", uploadError);
        setError(uploadError || "Could not upload photo. Please try again.");
        return;
      }

      const nextUrl = url || "";
      setAvatarUrl(nextUrl);
      setAvatarPreviewUri(
        nextUrl
          ? `${nextUrl}${nextUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
          : "",
      );

      // Clear the picked asset so the UI reflects the uploaded URL as the source of truth.
      setPickedAsset(null);
    },
    [upload, setError, setAvatarUrl, setAvatarPreviewUri, setPickedAsset],
  );

  return { pickImage, uploadAvatar };
}
