import { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import KeyboardAvoidingAnimatedView from "@/components/KeyboardAvoidingAnimatedView";
import * as Location from "expo-location";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import authedFetch from "@/utils/authedFetch";
import { useAuth } from "@/utils/auth/useAuth";
import { colors, radii, shadow } from "@/utils/theme";
import ErrorNotice from "@/components/ErrorNotice";
import { friendlyErrorMessage } from "@/utils/errors";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

function clampText(value, maxLen) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLen) {
    return value;
  }
  return value.slice(0, maxLen);
}

function formatWhen(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function PillButton({ title, selected, onPress }) {
  const bg = selected ? colors.primary : "rgba(16,24,40,0.04)";
  const color = selected ? colors.primaryText : colors.primary;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: 8,
        marginBottom: 10,
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, selected, onPress }) {
  const bg = selected ? colors.primary : "rgba(16,24,40,0.04)";
  const color = selected ? colors.primaryText : colors.primary;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        marginRight: 8,
        marginBottom: 10,
      }}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { auth } = useAuth();

  const currentUserId = useMemo(() => {
    const raw = auth?.user?.id;
    const n = typeof raw === "number" ? raw : parseInt(String(raw || ""), 10);
    return Number.isFinite(n) ? n : null;
  }, [auth?.user?.id]);

  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [locationName, setLocationName] = useState("");
  const [selectedInterest, setSelectedInterest] = useState(null);

  // Keep device coords separate from the picked venue coords.
  const [deviceCoords, setDeviceCoords] = useState(null);
  const [placeCoords, setPlaceCoords] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  const [placeAddress, setPlaceAddress] = useState("");

  const [startPreset, setStartPreset] = useState("soon");

  const onboardingQuery = useQuery({
    queryKey: ["onboardingStatus"],
    queryFn: async () => {
      const response = await authedFetch("/api/onboarding/status");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/onboarding/status, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const interestOptions = useMemo(() => {
    const list = onboardingQuery.data?.onboarding?.interests;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.slice(0, 12);
  }, [onboardingQuery.data?.onboarding?.interests]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!mounted) {
          return;
        }
        if (!perm?.granted) {
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!mounted) {
          return;
        }

        const lat = current?.coords?.latitude;
        const lng = current?.coords?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          setDeviceCoords({ lat, lng });
        }
      } catch (err) {
        console.error(err);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const startsAt = useMemo(() => {
    const now = Date.now();
    if (startPreset === "1h") {
      return new Date(now + 60 * 60 * 1000);
    }
    if (startPreset === "tonight") {
      const d = new Date(now);
      d.setHours(19, 0, 0, 0);
      if (d.getTime() < now) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
    if (startPreset === "tomorrow") {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    // soon
    return new Date(now + 2 * 60 * 60 * 1000);
  }, [startPreset]);

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await authedFetch("/api/events");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/events, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const coordsToUse = placeCoords || deviceCoords;

      const payload = {
        title: clampText(title.trim(), 120),
        locationName: clampText(locationName.trim(), 160),
        interest: selectedInterest || "",
        lat: coordsToUse?.lat ?? null,
        lng: coordsToUse?.lng ?? null,
        startsAt: startsAt.toISOString(),
        placeId: placeId || null,
        placeAddress: clampText(placeAddress || "", 255),
      };

      const response = await authedFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/events, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      setError(null);
      setTitle("");
      setLocationName("");
      setPlaceCoords(null);
      setPlaceId(null);
      setPlaceAddress("");
      setStartPreset("soon");
      setSelectedInterest(null);
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
    },
    onError: (err) => {
      console.error(err);
      setError(friendlyErrorMessage(err, "Could not create event."));
    },
  });

  const messageHostMutation = useMutation({
    mutationFn: async ({ targetUserId }) => {
      const response = await authedFetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          err.status = 403;
          throw err;
        }

        const msg = getErrorMessageFromBody(data, response);
        const err = new Error(
          `When fetching /api/messages/conversations, the response was [${response.status}] ${msg}`,
        );
        err.status = response.status;
        err.userMessage = msg;
        throw err;
      }

      return data;
    },
    onSuccess: async () => {
      // So the chat appears instantly in the Messages tab.
      await invalidateMany(queryClient, [["conversations"], ["notifications"]]);
    },
  });

  const onMessageHost = useCallback(
    async (e) => {
      const targetUserId = e?.creatorUserId;
      if (!targetUserId || messageHostMutation.isPending) {
        return;
      }
      if (typeof currentUserId === "number" && targetUserId === currentUserId) {
        return;
      }

      try {
        const data = await messageHostMutation.mutateAsync({ targetUserId });
        const conversationId = data?.conversationId;
        if (!conversationId) {
          return;
        }

        const safeTitle =
          typeof e?.title === "string" && e.title.trim()
            ? e.title.trim()
            : "meetup";
        const interestValue = e?.interest ? String(e.interest) : "";
        const interestLabel = e?.interest
          ? getInterestLabel(e.interest) || e.interest
          : null;

        // shorter, friendlier opener; chat has quick starters for alternatives
        const starterMessage = interestLabel
          ? `Hey! Your ${safeTitle} (${interestLabel}) looks fun — is it still open to more people?`
          : `Hey! Your ${safeTitle} looks fun — is it still open to more people?`;

        router.push({
          pathname: `/messages/${conversationId}`,
          params: {
            otherUserId: String(targetUserId),
            otherDisplayName: "Host",
            otherIsMinor: "0",
            starterMessage,
            // NEW: context for quick starters
            contextType: "event",
            contextInterest: interestValue,
            contextEventTitle: safeTitle,
            contextLocationName: e?.locationName || "",
          },
        });
      } catch (err) {
        console.error(err);
        if (err?.code === "VERIFY_REQUIRED") {
          setError("Please verify your email before messaging people.");
          return;
        }
        if (err?.status === 403) {
          setError(err?.userMessage || "Can't message this person.");
          return;
        }
        setError("Could not start chat.");
      }
    },
    [currentUserId, messageHostMutation, router],
  );

  const events = useMemo(() => {
    const list = eventsQuery.data?.events;
    if (!Array.isArray(list)) {
      return [];
    }
    return list;
  }, [eventsQuery.data?.events]);

  const onCreate = useCallback(() => {
    setError(null);
    if (!title.trim()) {
      setError("Please add a title.");
      return;
    }
    if (!selectedInterest) {
      setError("Pick an interest so this shows on the map.");
      return;
    }
    // We still allow events without selecting a venue, but warn users.
    if (!placeCoords && !deviceCoords) {
      setError("Turn on location so we can pin this on the map.");
      return;
    }
    createMutation.mutate();
  }, [createMutation, deviceCoords, placeCoords, selectedInterest, title]);

  const headerSubtitle = useMemo(() => {
    return "Post something simple. It shows on the map.";
  }, []);

  const startsLabel = useMemo(() => {
    return formatWhen(startsAt);
  }, [startsAt]);

  const createButtonTitle = useMemo(() => {
    return createMutation.isPending ? "Creating…" : "Create event";
  }, [createMutation.isPending]);

  const onboardingErrorMessage = useMemo(() => {
    if (!onboardingQuery.error) {
      return null;
    }
    return friendlyErrorMessage(
      onboardingQuery.error,
      "Could not load your interests.",
    );
  }, [onboardingQuery.error]);

  const eventsLoadError = useMemo(() => {
    if (!eventsQuery.error) {
      return null;
    }
    return friendlyErrorMessage(eventsQuery.error, "Could not load events.");
  }, [eventsQuery.error]);

  const onRetry = useCallback(() => {
    invalidateMany(queryClient, [["onboardingStatus"], ["events"]]);
  }, [queryClient]);

  const canRetry = !!eventsQuery.error || !!onboardingQuery.error;

  const { refreshControl } = usePullToRefresh({
    queryKeys: [["onboardingStatus"], ["events"]],
    onRefresh: () => setError(null),
  });

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.button,
                backgroundColor: colors.surfaceTint,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={20} color={colors.primary} />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{ fontSize: 22, fontWeight: "900", color: colors.text }}
              >
                Events
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: colors.subtext,
                  lineHeight: 18,
                  fontWeight: "700",
                }}
              >
                {headerSubtitle}
              </Text>
            </View>

            <View style={{ width: 44 }} />
          </View>

          {error ? (
            <View
              style={{
                marginTop: 14,
                backgroundColor: colors.dangerBg,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: "rgba(176,0,32,0.12)",
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
                {error}
              </Text>
            </View>
          ) : null}

          <ErrorNotice
            message={onboardingErrorMessage}
            onRetry={canRetry ? onRetry : null}
            style={onboardingErrorMessage ? { marginTop: 14 } : null}
          />

          <View
            style={{
              marginTop: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "rgba(255,255,255,0.96)",
              borderRadius: radii.card,
              padding: 14,
              ...shadow.card,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}
            >
              Create an event
            </Text>

            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.primary,
                  marginBottom: 8,
                }}
              >
                Interest
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {interestOptions.length ? (
                  interestOptions.map((it) => {
                    const label = getInterestLabel(it) || it;
                    return (
                      <Chip
                        key={it}
                        label={label}
                        selected={selectedInterest === it}
                        onPress={() =>
                          setSelectedInterest((current) =>
                            current === it ? null : it,
                          )
                        }
                      />
                    );
                  })
                ) : (
                  <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                    Add interests in onboarding first.
                  </Text>
                )}
              </View>
              {deviceCoords ? (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "rgba(16,24,40,0.55)",
                  }}
                >
                  We’ll pin this near your current location.
                </Text>
              ) : (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "rgba(16,24,40,0.55)",
                  }}
                >
                  Turn on location to pin this on the map.
                </Text>
              )}
            </View>

            <View style={{ marginTop: 10 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.primary,
                  marginBottom: 6,
                }}
              >
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={(t) => setTitle(clampText(t, 120))}
                placeholder="e.g. Coffee + walk"
                placeholderTextColor="#9A9AA0"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radii.button,
                  paddingHorizontal: 12,
                  height: 46,
                  backgroundColor: "#FFFFFF",
                  color: colors.text,
                  fontSize: 15,
                }}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <PlaceAutocompleteInput
                label="Venue (recommended)"
                value={locationName}
                onChangeValue={(t) => {
                  setLocationName(t);
                  setPlaceCoords(null);
                  setPlaceId(null);
                  setPlaceAddress("");
                }}
                placeholder="Type a place (e.g. Sushi bar)"
                biasCoords={deviceCoords}
                helperText="Pick a venue so the pin lands on the right spot."
                onPick={(place) => {
                  const lat = place?.lat;
                  const lng = place?.lng;
                  if (typeof lat === "number" && typeof lng === "number") {
                    setPlaceCoords({ lat, lng });
                  }
                  setPlaceId(place?.placeId || null);
                  setPlaceAddress(place?.formattedAddress || "");
                }}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.primary,
                  marginBottom: 8,
                }}
              >
                When
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <PillButton
                  title="Soon"
                  selected={startPreset === "soon"}
                  onPress={() => setStartPreset("soon")}
                />
                <PillButton
                  title="In 1h"
                  selected={startPreset === "1h"}
                  onPress={() => setStartPreset("1h")}
                />
                <PillButton
                  title="Tonight"
                  selected={startPreset === "tonight"}
                  onPress={() => setStartPreset("tonight")}
                />
                <PillButton
                  title="Tomorrow"
                  selected={startPreset === "tomorrow"}
                  onPress={() => setStartPreset("tomorrow")}
                />
              </View>
              {startsLabel ? (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "rgba(16,24,40,0.55)",
                  }}
                >
                  Starts: {startsLabel}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={onCreate}
              disabled={createMutation.isPending}
              style={{
                marginTop: 12,
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: radii.button,
                alignItems: "center",
                opacity: createMutation.isPending ? 0.6 : 1,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                {createButtonTitle}
              </Text>
            </TouchableOpacity>

            {placeCoords ? (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "rgba(16,24,40,0.55)",
                }}
              >
                Pinned to the venue’s location.
              </Text>
            ) : deviceCoords ? (
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "rgba(16,24,40,0.55)",
                }}
              >
                Pinned near your current location.
              </Text>
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text
              style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}
            >
              Upcoming
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "rgba(16,24,40,0.55)",
                fontWeight: "700",
              }}
            >
              Message the host to join.
            </Text>
          </View>

          <ErrorNotice
            message={eventsLoadError}
            onRetry={canRetry ? onRetry : null}
            style={eventsLoadError ? { marginTop: 12 } : null}
          />

          {eventsQuery.isLoading ? (
            <View style={{ alignItems: "center", marginTop: 18 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ marginTop: 12, gap: 12 }}>
              {events.length ? (
                events.map((e) => {
                  const when = formatWhen(e.startsAt);
                  const attendeeCount =
                    typeof e.attendeeCount === "number" ? e.attendeeCount : 0;

                  const isMine =
                    typeof currentUserId === "number" &&
                    typeof e.creatorUserId === "number" &&
                    e.creatorUserId === currentUserId;

                  return (
                    <View
                      key={e.id}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: "rgba(255,255,255,0.98)",
                        borderRadius: radii.card,
                        padding: 14,
                        ...shadow.card,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: colors.text,
                        }}
                      >
                        {e.title}
                      </Text>
                      {e.locationName ? (
                        <Text
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: colors.primary,
                            fontWeight: "800",
                          }}
                        >
                          {e.locationName}
                        </Text>
                      ) : null}
                      {when ? (
                        <Text
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: colors.subtext,
                            fontWeight: "700",
                          }}
                        >
                          {when}
                        </Text>
                      ) : null}

                      <View
                        style={{
                          marginTop: 10,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.subtext,
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {attendeeCount} going
                        </Text>

                        <TouchableOpacity
                          onPress={() => onMessageHost(e)}
                          disabled={messageHostMutation.isPending || isMine}
                          style={{
                            backgroundColor: colors.primary,
                            borderRadius: 999,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderWidth: 1,
                            borderColor: colors.primary,
                            opacity:
                              messageHostMutation.isPending || isMine ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primaryText,
                              fontWeight: "900",
                              fontSize: 13,
                            }}
                          >
                            {isMine ? "Your event" : "Message host"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "rgba(255,255,255,0.96)",
                    borderRadius: radii.card,
                    padding: 14,
                    ...shadow.card,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "900",
                      color: colors.primary,
                    }}
                  >
                    No events yet
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: colors.subtext,
                      lineHeight: 18,
                      fontWeight: "700",
                    }}
                  >
                    Create the first one.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
