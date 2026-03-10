import { Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { MapPin, ShieldCheck } from "lucide-react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { Pill } from "./Pill";

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

function minutesUntil(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.round((ms - Date.now()) / 60000);
}

function minutesLeft(value) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    return null;
  }
  return Math.max(0, Math.round((ms - Date.now()) / 60000));
}

export function PlanCard({
  checkin,
  initials,
  genderPref,
  isMine,
  primaryCtaTitle,
  primaryDisabled,
  onOpenProfile,
  onRequest,
  isRequesting,
  showInlineCta = true,
}) {
  const startRaw = checkin?.startsAt || checkin?.createdAt || null;
  const startClock = clockTime(startRaw);
  const minsUntilStart = minutesUntil(startRaw);
  const minsLeft = minutesLeft(checkin?.expiresAt);

  let timingLine = "";
  if (startClock && typeof minsUntilStart === "number") {
    if (minsUntilStart >= 2) {
      const suffix = minsUntilStart === 1 ? "min" : "mins";
      timingLine = `Starts at ${startClock} • in ~${minsUntilStart} ${suffix}`;
    } else if (minsUntilStart >= -1) {
      timingLine = `Starts now • ${startClock}`;
    } else {
      const minsAgo = Math.abs(minsUntilStart);
      const suffix = minsAgo === 1 ? "min" : "mins";
      timingLine = `Started at ${startClock} • ~${minsAgo} ${suffix} ago`;
    }
  } else if (startClock) {
    timingLine = `Starts at ${startClock}`;
  }

  if (typeof minsLeft === "number") {
    const endBit =
      minsLeft <= 0
        ? "Ends now"
        : `Ends in ${minsLeft} ${minsLeft === 1 ? "min" : "mins"}`;
    timingLine = timingLine ? `${timingLine} • ${endBit}` : endBit;
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.xl,
        overflow: "hidden",
        ...shadow.card,
      }}
    >
      <View
        style={{
          height: 180,
          backgroundColor: colors.mutedBg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        {checkin.avatarUrl ? (
          <Image
            source={{ uri: checkin.avatarUrl }}
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
              backgroundColor: colors.surfaceElevated,
            }}
          >
            <Text
              style={{
                fontSize: 40,
                fontWeight: "900",
                color: colors.text,
              }}
            >
              {initials}
            </Text>
          </View>
        )}
      </View>

      <View style={{ padding: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "900",
                color: colors.text,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {checkin.displayName || "Someone"}
            </Text>

            {checkin?.isVerified ? (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.chipBg,
                  borderWidth: 1,
                  borderColor: "rgba(139,92,246,0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck size={16} color={colors.primary} />
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={onOpenProfile}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              View profile
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {checkin.interest ? (
            <Pill
              text={getInterestLabel(checkin.interest) || checkin.interest}
            />
          ) : null}
          {typeof checkin.desiredGroupSize === "number" ? (
            <Pill text={`${checkin.desiredGroupSize} people`} />
          ) : null}
          {genderPref ? <Pill text={genderPref} /> : null}
        </View>

        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <MapPin size={16} color={colors.subtext} />
          <Text
            style={{
              color: colors.subtext,
              fontWeight: "800",
              flex: 1,
            }}
            numberOfLines={2}
          >
            {checkin.locationName}
          </Text>
        </View>

        {checkin.note ? (
          <Text
            style={{
              marginTop: 10,
              color: colors.text,
              fontWeight: "800",
              lineHeight: 20,
            }}
          >
            {checkin.note}
          </Text>
        ) : null}

        {timingLine ? (
          <Text
            style={{
              marginTop: 8,
              color: colors.subtext,
              fontWeight: "900",
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {timingLine}
          </Text>
        ) : null}

        {!isMine && showInlineCta ? (
          <TouchableOpacity
            onPress={onRequest}
            disabled={primaryDisabled}
            style={{
              marginTop: 14,
              backgroundColor: colors.primary,
              borderRadius: radii.lg,
              paddingVertical: 14,
              alignItems: "center",
              opacity: primaryDisabled ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: colors.primaryText,
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {isRequesting ? "Sending…" : primaryCtaTitle}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
