import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import authedFetch from "@/utils/authedFetch";
import { withQuery } from "@/utils/queryString";

function clampText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLen) {
    return value;
  }
  return value.slice(0, maxLen);
}

export default function PlaceAutocompleteInput({
  label,
  placeholder,
  value,
  onChangeValue,
  biasCoords,
  onPick,
  helperText,
}) {
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState(value || "");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState([]);

  const fetchIdRef = useRef(0);

  useEffect(() => {
    const next = value || "";
    const t = setTimeout(() => setDebounced(next), 200);
    return () => clearTimeout(t);
  }, [value]);

  const canQuery = useMemo(() => {
    const q = (debounced || "").trim();
    return focused && q.length >= 2;
  }, [debounced, focused]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!canQuery) {
        setPredictions([]);
        setError(null);
        return;
      }

      const q = (debounced || "").trim();
      const fetchId = (fetchIdRef.current += 1);

      setLoading(true);
      setError(null);

      const lat = biasCoords?.lat;
      const lng = biasCoords?.lng;

      const url = withQuery("/api/places/autocomplete", {
        input: q,
        radiusMeters: 805,
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
      });

      try {
        const response = await authedFetch(url);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = data?.error || response.statusText;
          throw new Error(
            `When fetching /api/places/autocomplete, the response was [${response.status}] ${msg}`,
          );
        }

        if (cancelled) {
          return;
        }

        // stale request guard
        if (fetchId !== fetchIdRef.current) {
          return;
        }

        const list = Array.isArray(data?.predictions) ? data.predictions : [];
        setPredictions(list);
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error(err);
        setError("Could not load nearby places.");
        setPredictions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [biasCoords?.lat, biasCoords?.lng, canQuery, debounced]);

  const onSelectPrediction = async (p) => {
    const placeId = p?.placeId;
    if (!placeId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authedFetch(
        withQuery("/api/places/details", { placeId }),
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/places/details, the response was [${response.status}] ${msg}`,
        );
      }

      const place = data?.place;
      const name = place?.name || p?.mainText || p?.description || "";
      onChangeValue(name);

      setFocused(false);
      setPredictions([]);

      if (typeof onPick === "function") {
        onPick({
          placeId,
          name,
          formattedAddress: place?.formattedAddress || "",
          lat: typeof place?.lat === "number" ? place.lat : null,
          lng: typeof place?.lng === "number" ? place.lng : null,
        });
      }
    } catch (err) {
      console.error(err);
      setError("Could not load that place.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {label ? (
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: "#2D114D",
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}

      <View style={{ position: "relative" }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChangeValue(clampText(t, 160))}
          placeholder={placeholder}
          placeholderTextColor="#9A9AA0"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so taps on predictions still register.
            setTimeout(() => setFocused(false), 180);
          }}
          style={{
            borderWidth: 1,
            borderColor: "#E6E6E6",
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 46,
            backgroundColor: "#FFFFFF",
            color: "#111111",
            fontSize: 15,
            paddingRight: 40,
          }}
        />

        {loading ? (
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 0,
              bottom: 0,
              justifyContent: "center",
            }}
          >
            <ActivityIndicator />
          </View>
        ) : null}

        {focused && predictions.length ? (
          <View
            style={{
              position: "absolute",
              top: 50,
              left: 0,
              right: 0,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E6E6E6",
              borderRadius: 14,
              overflow: "hidden",
              zIndex: 50,
              maxHeight: 250,
            }}
          >
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const title = item?.mainText || item?.description || "";
                const subtitle = item?.secondaryText || "";
                return (
                  <TouchableOpacity
                    onPress={() => onSelectPrediction(item)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(0,0,0,0.05)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "900",
                        color: "#1C1230",
                      }}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: "#6B6B6B",
                          fontWeight: "700",
                        }}
                        numberOfLines={1}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}
      </View>

      {helperText ? (
        <Text style={{ marginTop: 6, fontSize: 12, color: "#8A8A8A" }}>
          {helperText}
        </Text>
      ) : null}

      {error ? (
        <Text style={{ marginTop: 6, fontSize: 12, color: "#B00020" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
