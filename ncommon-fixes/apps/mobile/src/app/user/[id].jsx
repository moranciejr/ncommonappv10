import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import {
  ArrowLeft,
  MessageCircle,
  MoreHorizontal,
  Star,
  ShieldCheck,
  MapPin,
  Clock,
  Users,
  Sparkles,
  X,
  Send,
} from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import UpgradePromptModal from "@/components/UpgradePromptModal";
import { safeBack } from "@/utils/navigation";
import { invalidateMany } from "@/utils/retryQueries";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { MeetupsList } from "@/components/Meetups/MeetupsList";
import { useMeetups } from "@/hooks/useMeetups";
import { useNCommonWithUser } from "@/hooks/useNCommonWithUser";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = 400;
const ACCENT = "#0EA5A5"; // soft electric teal

const MOOD_EMOJI_MAP = {
  "Down for anything": "🎉",
  "Chill hangout": "☕",
  "Active / sporty": "🏓",
  "Food & drinks": "🍕",
  "Exploring the city": "🗺️",
  "Study / work buddy": "💻",
  "Deep conversations": "💭",
  "Adventure time": "🏔️",
};

function safeInt(value) {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "number") {
    return Number.isFinite(first) && first > 0 ? first : null;
  }
  const n = typeof first === "string" ? parseInt(first, 10) : null;
  if (!n || Number.isNaN(n)) {
    return null;
  }
  return n;
}

function initialsFromName(name) {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) return "?";
  const parts = safe.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1] || "";
  return `${first}${second}`.toUpperCase() || "?";
}

function formatCountdown(expiresAt) {
  try {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Ending soon";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m left`;
  } catch {
    return "";
  }
}

function formatStartTime(startsAt) {
  try {
    const d = new Date(startsAt);
    return d.toLocaleString([], {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ── Interest chip (lavender pill) ── */
function InterestPill({ label }) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "rgba(139,92,246,0.1)",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
        {label}
      </Text>
    </View>
  );
}

/* ── Mood icon chip ── */
function MoodChip({ mood }) {
  const emoji = MOOD_EMOJI_MAP[mood] || "✨";
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 11,
          fontWeight: "700",
          color: colors.subtext,
          textAlign: "center",
          maxWidth: 72,
        }}
        numberOfLines={2}
      >
        {mood}
      </Text>
    </View>
  );
}

/* ── Join Activity Bottom Sheet Modal ── */
function JoinActivitySheet({
  visible,
  onClose,
  checkin,
  onSend,
  isSending,
  requestStatus,
}) {
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    onSend(checkin?.id, message.trim());
  }, [checkin?.id, message, onSend]);

  const alreadyRequested =
    requestStatus === "pending" || requestStatus === "accepted";

  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(10,20,30,0.35)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.surfaceElevated,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 36,
            ...shadow.card,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#D0D5DD",
              alignSelf: "center",
              marginBottom: 16,
            }}
          />

          {/* Close */}
          <TouchableOpacity
            onPress={onClose}
            style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}
          >
            <X size={22} color={colors.subtext} />
          </TouchableOpacity>

          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
            Join Activity
          </Text>

          {/* Event summary card */}
          {checkin ? (
            <View
              style={{
                marginTop: 14,
                backgroundColor: colors.mutedBg,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <MapPin size={16} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: colors.text,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {checkin.locationName}
                </Text>
              </View>
              {checkin.interest ? (
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: "700",
                    color: colors.subtext,
                  }}
                >
                  {getInterestLabel(checkin.interest)}
                </Text>
              ) : null}
              {checkin.expiresAt ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  <Clock size={13} color={ACCENT} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: ACCENT,
                    }}
                  >
                    {formatCountdown(checkin.expiresAt)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Optional message */}
          {!alreadyRequested ? (
            <View style={{ marginTop: 14 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: colors.subtext,
                  marginBottom: 8,
                }}
              >
                Add a note (optional)
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Hey, I'd love to join!"
                placeholderTextColor="#98A2B3"
                multiline
                maxLength={200}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 14,
                  padding: 12,
                  minHeight: 64,
                  fontSize: 14,
                  color: colors.text,
                  backgroundColor: "#FAFAFA",
                  textAlignVertical: "top",
                }}
              />
            </View>
          ) : null}

          {/* Buttons */}
          <View style={{ marginTop: 18, flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceElevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>
                Cancel
              </Text>
            </TouchableOpacity>

            {alreadyRequested ? (
              <View
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.mutedBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.subtext }}>
                  Request Sent
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSend}
                disabled={isSending}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                <Send size={16} color="#FFFFFF" />
                <Text style={{ fontWeight: "900", color: "#FFFFFF" }}>
                  Send Request
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ── Photo Viewer Modal ── */
function PhotoViewerModal({ visible, photoUrl, onClose }) {
  return (
    <Modal
      visible={!!visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.88)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: "absolute",
            top: 60,
            right: 20,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{
              width: SCREEN_WIDTH - 32,
              height: SCREEN_WIDTH - 32,
              borderRadius: 20,
            }}
            contentFit="contain"
          />
        ) : null}
      </TouchableOpacity>
    </Modal>
  );
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();

  const [upgradePrompt, setUpgradePrompt] = useState(null);
  const [joinSheetVisible, setJoinSheetVisible] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [joinRequestStatus, setJoinRequestStatus] = useState(null);
  const lastPromptReasonRef = useRef(null);

  const userId = useMemo(() => safeInt(params?.id), [params?.id]);

  const refreshKeys = useMemo(() => {
    if (!userId) return [];
    return [["userProfile", { userId }]];
  }, [userId]);

  const { refreshControl } = usePullToRefresh({ queryKeys: refreshKeys });

  /* ── Profile query ── */
  const profileQuery = useQuery({
    queryKey: ["userProfile", { userId }],
    enabled: !!userId,
    queryFn: async ({ signal } = {}) => {
      const response = await authedFetch(`/api/users/${userId}`, { signal });
      const data = await readResponseBody(response);
      if (!response.ok) {
        if (response.status === 402 && data?.upgradeNudge) {
          const err = new Error(data?.error || "Upgrade required");
          err.code = "UPGRADE_REQUIRED";
          err.payload = data;
          throw err;
        }
        const msg = getErrorMessageFromBody(data, response);
        throw new Error(
          `When fetching /api/users/${userId}, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onError: (err) => {
      if (err?.code === "UPGRADE_REQUIRED") {
        const nudge = err?.payload?.upgradeNudge;
        if (nudge?.reason && lastPromptReasonRef.current !== nudge.reason) {
          lastPromptReasonRef.current = nudge.reason;
          setUpgradePrompt(nudge);
        } else if (!nudge) {
          setUpgradePrompt({
            title: "Upgrade",
            message: "Upgrade to continue.",
            primaryCta: "Upgrade",
            secondaryCta: "Not now",
            target: "/upgrade",
            reason: "upgrade_required",
          });
        }
      }
    },
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    const nudge = profileQuery.data?.upgradeNudge;
    if (!nudge?.reason) return;
    if (lastPromptReasonRef.current === nudge.reason) return;
    lastPromptReasonRef.current = nudge.reason;
    setUpgradePrompt(nudge);
  }, [profileQuery.data?.upgradeNudge]);

  /* ── nCommon overlap ── */
  const ncommonQuery = useNCommonWithUser(userId);
  const overlapInterests = useMemo(() => {
    const list = ncommonQuery.data?.overlapInterests;
    return Array.isArray(list) ? list : [];
  }, [ncommonQuery.data?.overlapInterests]);

  const user = profileQuery.data?.user;
  const interests = Array.isArray(profileQuery.data?.interests)
    ? profileQuery.data.interests
    : [];
  const photos = Array.isArray(profileQuery.data?.photos)
    ? profileQuery.data.photos
    : [];
  const activeCheckin = profileQuery.data?.activeCheckin || null;
  const meetupCounts = profileQuery.data?.meetups || { count: 0, wouldMeetAgainCount: 0 };

  // Fetch full meetup list for this profile.
  const { meetups, meetupsQuery } = useMeetups({ userId });
  const viewer = profileQuery.data?.viewer;
  const isStarred = !!viewer?.isStarred;
  const isMe = !!viewer?.isMe;

  /* ── Star mutation ── */
  const toggleStarMutation = useMutation({
    mutationFn: async ({ nextStarred }) => {
      const response = await authedFetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextStarred ? "add" : "remove",
          targetUserId: userId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/stars, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onMutate: async ({ nextStarred }) => {
      await queryClient.cancelQueries({
        queryKey: ["userProfile", { userId }],
      });
      await queryClient.cancelQueries({ queryKey: ["stars"] });
      const previousProfile = queryClient.getQueryData([
        "userProfile",
        { userId },
      ]);
      const previousStars = queryClient.getQueryData(["stars"]);
      queryClient.setQueryData(["userProfile", { userId }], (old) => ({
        ...(old || {}),
        viewer: { ...(old?.viewer || {}), isStarred: nextStarred },
      }));
      if (!nextStarred) {
        queryClient.setQueryData(["stars"], (old) => {
          const list = old?.users;
          if (!Array.isArray(list)) return old;
          return { ...old, users: list.filter((u) => u.id !== userId) };
        });
      }
      return { previousProfile, previousStars };
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      if (ctx?.previousProfile)
        queryClient.setQueryData(
          ["userProfile", { userId }],
          ctx.previousProfile,
        );
      if (ctx?.previousStars)
        queryClient.setQueryData(["stars"], ctx.previousStars);
      Alert.alert("Could not update star", "Please try again.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["userProfile", { userId }],
      });
      await queryClient.invalidateQueries({ queryKey: ["stars"] });
      await queryClient.invalidateQueries({ queryKey: ["nearby"] });
      await queryClient.invalidateQueries({ queryKey: ["ncommon"] });
      await queryClient.invalidateQueries({ queryKey: ["mapPoints"] });
    },
  });

  const onToggleStar = useCallback(() => {
    if (!userId || toggleStarMutation.isPending) return;
    toggleStarMutation.mutate({ nextStarred: !isStarred });
  }, [isStarred, toggleStarMutation, userId]);

  /* ── Message mutation ── */
  const startConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
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
      await invalidateMany(queryClient, [["conversations"], ["notifications"]]);
    },
    onError: (err) => {
      console.error(err);
      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        if (nudge?.reason && lastPromptReasonRef.current !== nudge.reason) {
          lastPromptReasonRef.current = nudge.reason;
        }
        setUpgradePrompt(
          nudge || {
            title: "Verify your email",
            message: "Please verify your email before starting chats.",
            primaryCta: "Verify email",
            secondaryCta: "Not now",
            target: "/verify-email",
            reason: "email_verify_required_start_chat",
          },
        );
        return;
      }
      if (err?.status === 403) {
        Alert.alert("Can't message", err?.userMessage || "Not allowed.");
        return;
      }
      Alert.alert("Could not start chat", "This may be restricted for safety.");
    },
  });

  /* ── Join request mutation ── */
  const joinRequestMutation = useMutation({
    mutationFn: async ({ planId }) => {
      const response = await authedFetch(`/api/checkins/${planId}/request`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403 && data?.verifyNudge) {
          const err = new Error(data?.error || "Email verification required");
          err.code = "VERIFY_REQUIRED";
          err.payload = data;
          throw err;
        }
        const msg = data?.error || response.statusText;
        const err = new Error(
          `When fetching /api/checkins/${planId}/request, the response was [${response.status}] ${msg}`,
        );
        err.userMessage = msg;
        err.status = response.status;
        throw err;
      }
      return data;
    },
    onSuccess: () => {
      setJoinRequestStatus("pending");
      Alert.alert("Requested", "Waiting for approval.");
    },
    onError: (err) => {
      console.error(err);
      if (err?.code === "VERIFY_REQUIRED") {
        const nudge = err?.payload?.verifyNudge;
        if (nudge) {
          setUpgradePrompt(nudge);
          return;
        }
      }
      Alert.alert("Could not request", err?.userMessage || "Please try again.");
    },
  });

  const handleJoinSend = useCallback(
    (planId) => {
      if (!planId || joinRequestMutation.isPending) return;
      joinRequestMutation.mutate({ planId });
    },
    [joinRequestMutation],
  );

  /* ── Block + Report ── */
  const blockMutation = useMutation({
    mutationFn: async () => {
      const response = await authedFetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/blocks, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateMany(queryClient, [
        ["blocks"],
        ["conversations"],
        ["notifications"],
        ["nearby"],
        ["ncommon"],
        ["stars"],
        ["checkins"],
        ["events"],
        ["mapPoints"],
      ]);
      Alert.alert("Blocked", "They won't show up for you anymore.");
      router.back();
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not block", "Please try again.");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ reason, details }) => {
      const response = await authedFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId, reason, details }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.error || response.statusText;
        throw new Error(
          `When fetching /api/reports, the response was [${response.status}] ${msg}`,
        );
      }
      return data;
    },
    onSuccess: () => {
      Alert.alert(
        "Thanks",
        "We received your report. If you're in danger, call 911.",
      );
    },
    onError: (err) => {
      console.error(err);
      Alert.alert("Could not report", "Please try again.");
    },
  });

  const onPressMore = useCallback(() => {
    if (isMe) return;
    Alert.alert("Options", "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        onPress: () => {
          Alert.alert("Report user", "Pick a reason", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Solicitation",
              style: "destructive",
              onPress: () =>
                reportMutation.mutate({ reason: "solicitation", details: "" }),
            },
            {
              text: "Harassment",
              style: "destructive",
              onPress: () =>
                reportMutation.mutate({ reason: "harassment", details: "" }),
            },
            {
              text: "Other",
              style: "destructive",
              onPress: () =>
                reportMutation.mutate({ reason: "other", details: "" }),
            },
          ]);
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            `Block ${user?.displayName || "this user"}?`,
            "They will disappear from your map and lists, and messaging will be blocked.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: () => blockMutation.mutate(),
              },
            ],
          );
        },
      },
    ]);
  }, [blockMutation, isMe, reportMutation, user?.displayName]);

  const openNudgeTarget = useCallback(() => {
    const target = upgradePrompt?.target || "/upgrade";
    setUpgradePrompt(null);
    router.push(target);
  }, [router, upgradePrompt?.target]);

  const dismissUpgrade = useCallback(() => setUpgradePrompt(null), []);

  /* ── Derived display values ── */
  const headerName = user?.displayName || "Profile";
  const ageText =
    user?.showAge && typeof user?.age === "number" ? `, ${user.age}` : "";
  const titleText = `${headerName}${ageText}`;
  const initials = initialsFromName(headerName);

  const locationParts = [];
  if (user?.city) locationParts.push(user.city);
  if (user?.state) locationParts.push(user.state);
  const locationText = locationParts.join(", ");

  const heroPhoto = photos[0]?.url || user?.avatarUrl || "";

  // Color for no-photo hero based on first interest
  const heroBgColor = useMemo(() => {
    if (heroPhoto) return colors.primary;
    const interest = interests[0] || "";
    let hash = 0;
    for (let i = 0; i < interest.length; i++) {
      hash = (hash * 31 + interest.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 50%, 35%)`;
  }, [heroPhoto, interests]);

  // Photo grid (skip hero photo)
  const gridPhotos = useMemo(() => {
    return photos.slice(1, 7);
  }, [photos]);

  const GRID_GAP = 8;
  const GRID_PAD = 20;
  const GRID_COLS = 3;
  const gridItemSize =
    (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

  /* ── Early returns ── */
  if (!userId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8F7FA",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.subtext, fontWeight: "700" }}>
          Invalid user.
        </Text>
        <TouchableOpacity
          onPress={() => safeBack(router, "/")}
          style={{
            marginTop: 14,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 16,
            ...shadow.card,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8F7FA",
          paddingTop: insets.top,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (profileQuery.error || !user) {
    const paywalled = !!upgradePrompt;
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8F7FA",
          paddingTop: insets.top,
          paddingHorizontal: 20,
        }}
      >
        <UpgradePromptModal
          visible={!!upgradePrompt}
          title={upgradePrompt?.title}
          message={upgradePrompt?.message}
          primaryText={upgradePrompt?.primaryCta || "Upgrade"}
          secondaryText={upgradePrompt?.secondaryCta || "Not now"}
          onPrimary={openNudgeTarget}
          onClose={dismissUpgrade}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => safeBack(router, "/")}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              ...shadow.card,
            }}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
            Profile
          </Text>
        </View>
        <View
          style={{
            marginTop: 18,
            backgroundColor: paywalled
              ? "rgba(247,245,255,0.96)"
              : "rgba(176,0,32,0.12)",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: paywalled ? colors.text : "#FF6B6B",
              fontWeight: "900",
            }}
          >
            {paywalled
              ? "Upgrade to keep browsing"
              : "Could not load this profile."}
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
          >
            {paywalled
              ? upgradePrompt?.message ||
                "You've reached a free-tier limit. Upgrade for more access."
              : "Please try again."}
          </Text>
          {paywalled ? (
            <TouchableOpacity
              onPress={openNudgeTarget}
              style={{
                marginTop: 12,
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                ...shadow.card,
              }}
            >
              <Text style={{ fontWeight: "900", color: "#FFFFFF" }}>
                {upgradePrompt?.primaryCta || "Continue"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  /* ── Main Profile ── */
  return (
    <View style={{ flex: 1, backgroundColor: "#F8F7FA" }}>
      <UpgradePromptModal
        visible={!!upgradePrompt}
        title={upgradePrompt?.title}
        message={upgradePrompt?.message}
        primaryText={upgradePrompt?.primaryCta || "Upgrade"}
        secondaryText={upgradePrompt?.secondaryCta || "Not now"}
        onPrimary={openNudgeTarget}
        onClose={dismissUpgrade}
      />

      <JoinActivitySheet
        visible={joinSheetVisible}
        onClose={() => setJoinSheetVisible(false)}
        checkin={activeCheckin}
        onSend={handleJoinSend}
        isSending={joinRequestMutation.isPending}
        requestStatus={joinRequestStatus}
      />

      <PhotoViewerModal
        visible={!!viewingPhoto}
        photoUrl={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
      />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. Hero Section ─── */}
        <View style={{ width: "100%", height: HERO_HEIGHT }}>
          {heroPhoto ? (
            <Image
              source={{ uri: heroPhoto }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: heroBgColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ fontSize: 64, fontWeight: "900", color: "#FFFFFF" }}
              >
                {initials}
              </Text>
            </View>
          )}

          {/* Gradient overlay bottom fade */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: HERO_HEIGHT * 0.5,
            }}
          />

          {/* Back + More buttons overlaid */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              right: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => safeBack(router, "/")}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "rgba(255,255,255,0.22)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {!isMe ? (
              <TouchableOpacity
                onPress={onPressMore}
                disabled={blockMutation.isPending || reportMutation.isPending}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MoreHorizontal size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Name, age, badge overlaid at bottom of hero */}
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              right: 20,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: "#FFFFFF",
                }}
                numberOfLines={1}
              >
                {titleText}
              </Text>

              {user?.isVerified ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "rgba(255,255,255,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={16} color="#FFFFFF" />
                </View>
              ) : null}
            </View>

            {locationText ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 4,
                }}
              >
                <MapPin size={14} color="rgba(255,255,255,0.8)" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {locationText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── 2. Sticky Action Bar ─── */}
        {!isMe ? (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 20,
              paddingVertical: 14,
              backgroundColor: "#F8F7FA",
            }}
          >
            {activeCheckin ? (
              <TouchableOpacity
                onPress={() => setJoinSheetVisible(true)}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  ...shadow.card,
                }}
              >
                <Sparkles size={18} color="#FFFFFF" />
                <Text
                  style={{ fontWeight: "900", color: "#FFFFFF", fontSize: 15 }}
                >
                  Join Activity
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onToggleStar}
                disabled={toggleStarMutation.isPending}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  opacity: toggleStarMutation.isPending ? 0.7 : 1,
                  ...shadow.card,
                }}
              >
                <Star
                  size={18}
                  color={isStarred ? "#F5B700" : colors.text}
                  fill={isStarred ? "#F5B700" : "transparent"}
                />
                <Text
                  style={{
                    fontWeight: "900",
                    color: colors.text,
                    fontSize: 15,
                  }}
                >
                  {isStarred ? "Starred" : "Star"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() =>
                startConversationMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    const conversationId = data?.conversationId;
                    if (!conversationId) {
                      Alert.alert("Could not start chat", "Please try again.");
                      return;
                    }
                    router.push({
                      pathname: `/messages/${conversationId}`,
                      params: {
                        otherUserId: String(userId),
                        otherDisplayName: user.displayName || "Chat",
                        otherIsMinor: user.isMinor ? "1" : "0",
                      },
                    });
                  },
                })
              }
              disabled={startConversationMutation.isPending}
              style={{
                flex: 1,
                backgroundColor: colors.surfaceElevated,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                opacity: startConversationMutation.isPending ? 0.7 : 1,
                ...shadow.card,
              }}
            >
              <MessageCircle size={18} color={colors.text} />
              <Text
                style={{
                  fontWeight: "900",
                  color: colors.text,
                  fontSize: 15,
                }}
              >
                Message
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20 }}>
          {/* ─── 3. Activity Card ─── */}
          {activeCheckin ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 12,
                  letterSpacing: 0.3,
                }}
              >
                LIVE ACTIVITY
              </Text>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <MapPin size={18} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: colors.text,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {activeCheckin.locationName}
                </Text>
              </View>

              {activeCheckin.startsAt ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <Clock size={16} color={colors.subtext} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: colors.subtext,
                    }}
                  >
                    {formatStartTime(activeCheckin.startsAt)}
                  </Text>
                </View>
              ) : null}

              {activeCheckin.expiresAt ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <Clock size={16} color={ACCENT} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: ACCENT,
                    }}
                  >
                    {formatCountdown(activeCheckin.expiresAt)}
                  </Text>
                </View>
              ) : null}

              {activeCheckin.note ? (
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 13,
                    fontWeight: "700",
                    color: colors.subtext,
                    lineHeight: 18,
                  }}
                >
                  {activeCheckin.note}
                </Text>
              ) : null}
            </View>
          ) : !isMe ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: colors.subtext,
                }}
              >
                ✨ Available to plan something
              </Text>
            </View>
          ) : null}

          {/* ─── 4. nCommon Section ─── */}
          {overlapInterests.length > 0 && !isMe ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 12,
                }}
              >
                ✨ You both love
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                }}
              >
                {overlapInterests.map((interest) => (
                  <InterestPill
                    key={interest}
                    label={getInterestLabel(interest) || interest}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* ─── 5. Mood Section ─── */}
          {user.mood ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 12,
                }}
              >
                Current vibe
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <MoodChip mood={user.mood} />
              </View>
            </View>
          ) : null}

          {/* ─── 6. About Section ─── */}
          {user.bio ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 10,
                }}
              >
                About
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.text,
                  lineHeight: 22,
                }}
              >
                {user.bio}
              </Text>
            </View>
          ) : null}

          {/* ─── All Interests ─── */}
          {interests.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 12,
                }}
              >
                Interests
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {interests.slice(0, 12).map((interest) => (
                  <InterestPill
                    key={interest}
                    label={getInterestLabel(interest) || interest}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* ─── 7. People I've Met ─── */}
          {(meetups.length > 0 || meetupsQuery.isLoading) ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <MeetupsList
                meetups={meetups}
                isLoading={meetupsQuery.isLoading}
                onPress={(metUserId) => {
                  if (metUserId) router.push(`/user/${metUserId}`);
                }}
              />
            </View>
          ) : null}

          {/* ─── 8. Photo Grid ─── */}
          {gridPhotos.length > 0 ? (
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                ...shadow.card,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                  marginBottom: 12,
                }}
              >
                Photos
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: GRID_GAP,
                }}
              >
                {gridPhotos.map((p) => (
                  <TouchableOpacity
                    key={`photo-${p.id}`}
                    onPress={() => setViewingPhoto(p.url)}
                    activeOpacity={0.85}
                    style={{
                      width: gridItemSize,
                      height: gridItemSize,
                      borderRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      source={{ uri: p.url }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Star button at bottom if there's an active checkin (since primary CTA is Join) */}
          {!isMe && activeCheckin ? (
            <TouchableOpacity
              onPress={onToggleStar}
              disabled={toggleStarMutation.isPending}
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                marginBottom: 12,
                opacity: toggleStarMutation.isPending ? 0.7 : 1,
                ...shadow.card,
              }}
            >
              <Star
                size={18}
                color={isStarred ? "#F5B700" : colors.text}
                fill={isStarred ? "#F5B700" : "transparent"}
              />
              <Text
                style={{
                  fontWeight: "900",
                  color: colors.text,
                  fontSize: 15,
                }}
              >
                {isStarred ? "Starred" : "Star"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
