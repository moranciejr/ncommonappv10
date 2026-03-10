import { useCallback, useMemo } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import {
  MessageCircle,
  MoreHorizontal,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { colors, radii, shadow } from "@/utils/theme";
import { formatDistanceFromKm } from "@/hooks/useAppSettings";

function initialsFromName(name) {
  const safe = typeof name === "string" ? name.trim() : "";
  if (!safe) {
    return "?";
  }
  const parts = safe.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1] || "";
  const joined = `${first}${second}`.toUpperCase();
  return joined || "?";
}

function Pill({ text, tone = "default" }) {
  const bg =
    tone === "primary"
      ? colors.chipBg
      : tone === "urgent"
        ? colors.primary
        : "rgba(16,24,40,0.06)";
  const color =
    tone === "primary"
      ? colors.primary
      : tone === "urgent"
        ? colors.primaryText
        : colors.text;

  const borderColor = tone === "urgent" ? "rgba(45,17,77,0.28)" : colors.border;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "900", color }}>{text}</Text>
    </View>
  );
}

function minutesUntilFromDate(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.round((ms - Date.now()) / 60000);
}

function minutesLeftFromDate(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  const mins = Math.round((ms - Date.now()) / 60000);
  return Math.max(0, mins);
}

function clockTime(value) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ProfileCard({
  person,
  variant, // 'ncommon' | 'nearest'
  distanceUnit, // 'mi' | 'km' (optional)
  onPress,
  onToggleStar,
  isToggling,
  onMessage,
  isMessaging,
  onBlock,
}) {
  const name = person?.displayName || "Someone";
  const initials = useMemo(() => initialsFromName(name), [name]);

  const isVerified = !!person?.isVerified;
  const age = typeof person?.age === "number" ? person.age : null;
  const showAge = !!person?.showAge;

  const titleText = useMemo(() => {
    if (showAge && typeof age === "number") {
      return `${name}, ${age}`;
    }
    return name;
  }, [age, name, showAge]);

  const city = person?.city || "";
  const state = person?.state || "";

  const locationBits = [];
  if (city) locationBits.push(city);
  if (state) locationBits.push(state);
  const locationText = locationBits.join(", ");

  const hideDistance = !!person?.hideDistance;
  const distanceKm =
    typeof person?.distanceKm === "number" ? person.distanceKm : null;

  const distanceText = useMemo(() => {
    if (hideDistance) {
      return null;
    }
    if (typeof distanceKm !== "number") {
      return null;
    }
    return formatDistanceFromKm(distanceKm, distanceUnit);
  }, [distanceKm, distanceUnit, hideDistance]);

  const overlapCount =
    typeof person?.overlapCount === "number" ? person.overlapCount : 0;

  const checkin = person?.checkin || null;
  const checkinPlace = checkin?.locationName || "";
  const checkinInterest = checkin?.interest || "";

  const startRaw = checkin?.startsAt || checkin?.createdAt || null;
  const startClock = useMemo(() => clockTime(startRaw), [startRaw]);
  const minsUntilStart = useMemo(
    () => (variant === "nearest" ? minutesUntilFromDate(startRaw) : null),
    [startRaw, variant],
  );

  const minsLeft = useMemo(() => {
    if (variant !== "nearest") {
      return null;
    }
    return minutesLeftFromDate(checkin?.expiresAt);
  }, [checkin?.expiresAt, variant]);

  const startState = useMemo(() => {
    if (variant !== "nearest") {
      return { kind: null, isUrgent: false };
    }

    // Happening now: already started, or starts within ~5 mins.
    if (typeof minsUntilStart === "number" && minsUntilStart <= 5) {
      return { kind: "now", isUrgent: true };
    }

    // Starts soon: 5–60 mins.
    if (
      typeof minsUntilStart === "number" &&
      minsUntilStart > 5 &&
      minsUntilStart <= 60
    ) {
      return { kind: "soon", isUrgent: false };
    }

    return { kind: null, isUrgent: false };
  }, [minsUntilStart, variant]);

  const cardBorderColor = useMemo(() => {
    if (variant === "nearest" && startState?.kind) {
      return startState?.isUrgent
        ? "rgba(45,17,77,0.38)"
        : "rgba(45,17,77,0.18)";
    }
    return colors.border;
  }, [startState?.isUrgent, startState?.kind, variant]);

  const cardBg = useMemo(() => {
    if (variant === "nearest" && startState?.kind) {
      return startState?.isUrgent
        ? "rgba(45,17,77,0.06)"
        : "rgba(45,17,77,0.03)";
    }
    return colors.card;
  }, [startState?.isUrgent, startState?.kind, variant]);

  const heroBadge = useMemo(() => {
    if (variant !== "nearest") {
      return null;
    }

    if (!startState?.kind) {
      return null;
    }

    const isUrgent = startState?.isUrgent;

    const bg = isUrgent ? colors.primary : "rgba(255,255,255,0.92)";
    const borderColor = isUrgent ? "rgba(45,17,77,0.38)" : colors.border;
    const color = isUrgent ? colors.primaryText : colors.primary;

    let label = "";

    if (startState.kind === "soon") {
      const mins =
        typeof minsUntilStart === "number" ? Math.max(0, minsUntilStart) : null;
      if (typeof mins === "number" && mins >= 2) {
        const suffix = mins === 1 ? "min" : "mins";
        label = `Starts soon • ${mins} ${suffix}`;
      } else {
        label = "Starts soon";
      }
    }

    if (startState.kind === "now") {
      if (typeof minsUntilStart === "number" && minsUntilStart >= 2) {
        const mins = minsUntilStart;
        const suffix = mins === 1 ? "min" : "mins";
        label = `Starting now • ${mins} ${suffix}`;
      } else if (typeof minsUntilStart === "number" && minsUntilStart <= -2) {
        const minsAgo = Math.abs(minsUntilStart);
        if (minsAgo >= 120) {
          const hrs = Math.round(minsAgo / 60);
          label = `Happening now • started ~${hrs}h ago`;
        } else {
          const suffix = minsAgo === 1 ? "min" : "mins";
          label = `Happening now • started ~${minsAgo} ${suffix} ago`;
        }
      } else {
        label = "Starting now";
      }
    }

    if (!label) {
      return null;
    }

    return { label, bg, borderColor, color };
  }, [minsUntilStart, startState?.isUrgent, startState?.kind, variant]);

  const starFill = person?.isStarred ? "#F5B700" : "transparent";
  const starStroke = person?.isStarred ? "#F5B700" : colors.text;

  const confirmBlock = useCallback(() => {
    if (!person?.id) {
      return;
    }
    Alert.alert(
      `Block ${name}?`,
      "They will disappear from your map and lists, and messaging will be blocked.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => onBlock?.(person.id),
        },
      ],
    );
  }, [name, onBlock, person?.id]);

  const metaLine = useMemo(() => {
    if (variant === "nearest") {
      const bits = [];
      if (distanceText) bits.push(distanceText);
      if (locationText) bits.push(locationText);
      return bits.join(" • ");
    }

    // ncommon
    if (locationText) {
      return locationText;
    }
    return "";
  }, [distanceText, locationText, variant]);

  const topPills = useMemo(() => {
    const out = [];

    if (variant === "ncommon" && overlapCount > 0) {
      out.push({ text: `${overlapCount} in common`, tone: "primary" });
    }

    if (variant === "nearest") {
      // Keep interest pill; urgency is now shown as a more prominent hero badge
      if (checkinInterest) {
        out.push({ text: checkinInterest, tone: "primary" });
      }
    }

    return out;
  }, [checkinInterest, overlapCount, variant]);

  const timeLine = useMemo(() => {
    if (variant !== "nearest") {
      return null;
    }

    const bits = [];

    // Start info FIRST.
    if (typeof minsUntilStart === "number" && startClock) {
      if (minsUntilStart >= 2) {
        const suffix = minsUntilStart === 1 ? "min" : "mins";
        bits.push(`Starts at ${startClock} • in ~${minsUntilStart} ${suffix}`);
      } else if (minsUntilStart >= -1) {
        bits.push(`Starting now • ${startClock}`);
      } else {
        const minsAgo = Math.abs(minsUntilStart);
        const suffix = minsAgo === 1 ? "min" : "mins";
        bits.push(
          `Happening now • Started at ${startClock} • ~${minsAgo} ${suffix} ago`,
        );
      }
    } else if (startClock) {
      bits.push(`Starts at ${startClock}`);
    }

    // End time second.
    if (typeof minsLeft === "number") {
      if (minsLeft <= 0) {
        bits.push("Ends now");
      } else {
        const suffix = minsLeft === 1 ? "min" : "mins";
        bits.push(`Ends in ${minsLeft} ${suffix}`);
      }
    }

    if (!bits.length) {
      return null;
    }

    return bits.join(" • ");
  }, [minsLeft, minsUntilStart, startClock, variant]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      style={{
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: cardBorderColor,
        borderRadius: radii.card,
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      {/* Hero image */}
      <View
        style={{
          height: 180,
          backgroundColor: colors.mutedBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {person?.avatarUrl ? (
          <Image
            source={{ uri: person.avatarUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceTint,
            }}
          >
            <Text
              style={{ fontSize: 40, fontWeight: "900", color: colors.text }}
            >
              {initials}
            </Text>
          </View>
        )}

        {/* NEW: Top-left urgency badge */}
        {heroBadge ? (
          <View
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              backgroundColor: heroBadge.bg,
              borderWidth: 1,
              borderColor: heroBadge.borderColor,
              borderRadius: radii.pill,
              paddingHorizontal: 12,
              paddingVertical: 8,
              ...shadow.card,
            }}
          >
            <Text
              style={{
                color: heroBadge.color,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {heroBadge.label}
            </Text>
          </View>
        ) : null}

        {/* Top-right actions */}
        <View
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            flexDirection: "row",
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              if (person?.id) {
                onToggleStar?.(person.id, !person.isStarred);
              }
            }}
            disabled={isToggling}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: isToggling ? 0.6 : 1,
            }}
          >
            <Star size={18} color={starStroke} fill={starFill} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              onMessage?.(person);
            }}
            disabled={isMessaging}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: isMessaging ? 0.6 : 1,
            }}
          >
            <MessageCircle size={18} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e?.stopPropagation?.();
              confirmBlock();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.92)",
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MoreHorizontal size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Bottom-left pills */}
        <View
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
            right: 12,
          }}
        >
          {topPills.map((p) => (
            <Pill key={p.text} text={p.text} tone={p.tone} />
          ))}
        </View>
      </View>

      {/* Card body */}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            {titleText}
          </Text>

          {isVerified ? (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.chipBg,
                borderWidth: 1,
                borderColor: "rgba(45,17,77,0.14)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={16} color={colors.primary} />
            </View>
          ) : null}
        </View>

        {metaLine ? (
          <Text
            style={{
              marginTop: 6,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {metaLine}
          </Text>
        ) : null}

        {timeLine ? (
          <Text
            style={{
              marginTop: 8,
              color: startState?.isUrgent ? colors.primary : colors.subtext,
              fontWeight: "900",
            }}
            numberOfLines={3}
          >
            {timeLine}
          </Text>
        ) : null}

        {variant === "nearest" && checkinPlace ? (
          <View
            style={{
              marginTop: 10,
              backgroundColor: colors.surfaceTint,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{ color: colors.text, fontWeight: "900" }}
              numberOfLines={1}
            >
              {checkinPlace}
            </Text>
            {person?.checkin?.note ? (
              <Text
                style={{
                  marginTop: 4,
                  color: colors.subtext,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {person.checkin.note}
              </Text>
            ) : null}
          </View>
        ) : null}

        {variant === "ncommon" && person?.bio ? (
          <Text
            style={{
              marginTop: 10,
              color: colors.subtext,
              fontWeight: "700",
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {person.bio}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
