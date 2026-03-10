import { View, Image as RNImage, Text } from "react-native";
import { Marker } from "react-native-maps";
import { useEffect, useState, useCallback } from "react";
import { colorForInterest } from "@/utils/formatUtils";
import { getInterestCategoryIdForValue } from "@/utils/interestTaxonomy";
import {
  BookOpen,
  Gamepad2,
  Mountain,
  Music,
  Trophy,
  User,
  Utensils,
} from "lucide-react-native";
import { colors, shadow } from "@/utils/theme";

function toFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function buildCoordinate(lat, lng) {
  const safeLat = toFiniteNumber(lat);
  const safeLng = toFiniteNumber(lng);
  if (safeLat === null || safeLng === null) {
    return null;
  }
  return { latitude: safeLat, longitude: safeLng };
}

function Pin({ color, size = 40, badge = null, children }) {
  // Pure View-based pin (more reliable than SVG inside react-native-maps Marker).
  // NOTE: pins need to be readable on phones, so the inner art/avatar area is intentionally large.
  const height = Math.round(size * 1.34);
  const tipSize = Math.round(size * 0.46);
  const innerSize = Math.round(size * 0.66);
  const innerTop = Math.round(size * 0.12);

  return (
    <View
      style={{
        width: size,
        height,
        alignItems: "center",
        backgroundColor: "transparent",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
          ...shadow.card,
        }}
      />

      <View
        style={{
          position: "absolute",
          top: Math.round(size * 0.62),
          width: tipSize,
          height: tipSize,
          backgroundColor: color,
          borderRadius: Math.round(tipSize * 0.22),
          transform: [{ rotate: "45deg" }],
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
          ...shadow.card,
        }}
      />

      <View
        style={{
          position: "absolute",
          top: innerTop,
          width: innerSize,
          height: innerSize,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: "#FFFFFF", // solid inner circle so map never bleeds through
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.10)",
        }}
      >
        {children}
      </View>

      {badge ? (
        <View
          style={{
            position: "absolute",
            // sits under the inner circle, but still inside the main pin circle
            top: Math.round(size * 0.72),
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          {badge}
        </View>
      ) : null}
    </View>
  );
}

function PinAvatar({ url, onLoadEnd }) {
  const avatarUrl = typeof url === "string" ? url : "";
  const hasAvatar = !!avatarUrl;

  if (!hasAvatar) {
    return <User size={16} color={colors.text} />;
  }

  return (
    <RNImage
      source={{ uri: avatarUrl }}
      style={{ width: "100%", height: "100%" }}
      resizeMode="cover"
      onLoadEnd={onLoadEnd}
    />
  );
}

function getFallbackIconForCategoryId(categoryId) {
  if (categoryId === "food") {
    return Utensils;
  }
  if (categoryId === "music") {
    return Music;
  }
  if (categoryId === "games") {
    return Gamepad2;
  }
  if (categoryId === "outdoors") {
    return Mountain;
  }
  if (categoryId === "sports") {
    return Trophy;
  }

  // arts, fitness, learning, pets, shopping, volunteering, other
  return BookOpen;
}

function getInterestArtKeyForValue(interest) {
  const categoryId = getInterestCategoryIdForValue(interest);
  return categoryId || "other";
}

function PinInterestArt({ url, onLoadEnd, onError }) {
  const safe = typeof url === "string" ? url : "";
  if (!safe) {
    return null;
  }

  return (
    <RNImage
      source={{ uri: safe }}
      style={{ width: "96%", height: "96%" }}
      resizeMode="contain"
      onLoadEnd={onLoadEnd}
      onError={(error) => {
        console.log("Interest art failed to load:", safe);
        if (onError) onError(error);
      }}
    />
  );
}

function SmartMarker({ markerId, coordinate, onPress, hasImage, children }) {
  // Defensive: invalid coordinates can crash react-native-maps.
  if (
    !coordinate ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude)
  ) {
    return null;
  }

  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);

    // If we have an image (avatar), keep tracking longer so we don't snapshot before it loads.
    // We still force-disable after a while for performance.
    const ms = hasImage ? 4500 : 600;
    const t = setTimeout(() => setTracks(false), ms);
    return () => clearTimeout(t);
  }, [markerId, coordinate?.latitude, coordinate?.longitude, hasImage]);

  const handleImageLoadEnd = useCallback(() => {
    setTracks(false);
  }, []);

  const child =
    typeof children === "function"
      ? children({ onImageLoadEnd: handleImageLoadEnd })
      : children;

  return (
    <Marker
      key={markerId}
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
      tracksInfoWindowChanges={tracks}
    >
      {child}
    </Marker>
  );
}

function HotspotMarker({ h, onPress, interestArt }) {
  const [imageError, setImageError] = useState(false);

  const coordinate = buildCoordinate(h?.lat, h?.lng);
  if (!coordinate) {
    return null;
  }

  const pinColor = colorForInterest(h.interest);
  const artKey = getInterestArtKeyForValue(h.interest);
  const artUrl = interestArt?.[artKey] || interestArt?.other;
  const hasArt = typeof artUrl === "string" && artUrl.length > 0 && !imageError;
  const InterestIcon = getFallbackIconForCategoryId(artKey);

  return (
    <SmartMarker
      key={`hotspot-${h.id}`}
      markerId={`hotspot-${h.id}`}
      coordinate={coordinate}
      onPress={() => onPress(h)}
      hasImage={hasArt}
    >
      {hasArt ? (
        ({ onImageLoadEnd }) => (
          <Pin color={pinColor} size={58}>
            <PinInterestArt
              url={artUrl}
              onLoadEnd={onImageLoadEnd}
              onError={() => setImageError(true)}
            />
          </Pin>
        )
      ) : (
        <Pin color={pinColor} size={58}>
          <InterestIcon size={18} color={colors.text} />
        </Pin>
      )}
    </SmartMarker>
  );
}

export function HotspotMarkers({ hotspots, onPress, interestArt = null }) {
  return (
    <>
      {(Array.isArray(hotspots) ? hotspots : []).map((h) => (
        <HotspotMarker
          key={`hotspot-${h.id}`}
          h={h}
          onPress={onPress}
          interestArt={interestArt}
        />
      ))}
    </>
  );
}

export function UserMarkers({ users, onPress, visible = true }) {
  if (!visible) {
    return null;
  }

  return (
    <>
      {(Array.isArray(users) ? users : []).map((u) => {
        const coordinate = buildCoordinate(u?.lat, u?.lng);
        if (!coordinate) {
          return null;
        }
        const dot = colorForInterest(u.interest);

        // Be defensive about naming; some data sources might use avatar_url.
        const rawAvatar =
          typeof u.avatarUrl === "string"
            ? u.avatarUrl
            : typeof u.avatar_url === "string"
              ? u.avatar_url
              : "";

        const hasAvatar = !!rawAvatar;

        return (
          <SmartMarker
            key={`user-${u.id}`}
            markerId={`user-${u.id}`}
            coordinate={coordinate}
            onPress={() => onPress(u)}
            hasImage={hasAvatar}
          >
            {({ onImageLoadEnd }) => (
              <Pin color={dot} size={54}>
                <PinAvatar url={rawAvatar} onLoadEnd={onImageLoadEnd} />
              </Pin>
            )}
          </SmartMarker>
        );
      })}
    </>
  );
}

function EventMarker({ e, onPress, interestArt }) {
  const [imageError, setImageError] = useState(false);

  const coordinate = buildCoordinate(e?.lat, e?.lng);
  if (!coordinate) {
    return null;
  }

  const dot = colorForInterest(e.interest);
  const artKey = getInterestArtKeyForValue(e.interest);
  const artUrl = interestArt?.[artKey] || interestArt?.other;
  const hasArt = typeof artUrl === "string" && artUrl.length > 0 && !imageError;
  const InterestIcon = getFallbackIconForCategoryId(artKey);

  const showNow = e?.isHappeningNow === true;
  const nowBadge = showNow ? (
    <View
      style={{
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 26,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.92)",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.10)",
        ...shadow.card,
      }}
    >
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={{
          fontSize: 8,
          lineHeight: 10,
          fontWeight: "900",
          letterSpacing: 0.2,
          textAlign: "center",
          color: colors.primary,
        }}
      >
        NOW
      </Text>
    </View>
  ) : null;

  return (
    <SmartMarker
      key={`event-${e.id}`}
      markerId={`event-${e.id}`}
      coordinate={coordinate}
      onPress={() => onPress(e)}
      hasImage={hasArt}
    >
      {hasArt ? (
        ({ onImageLoadEnd }) => (
          <Pin color={dot} size={54} badge={nowBadge}>
            <PinInterestArt
              url={artUrl}
              onLoadEnd={onImageLoadEnd}
              onError={() => setImageError(true)}
            />
          </Pin>
        )
      ) : (
        <Pin color={dot} size={54} badge={nowBadge}>
          <InterestIcon size={18} color={colors.text} />
        </Pin>
      )}
    </SmartMarker>
  );
}

export function EventMarkers({
  events,
  onPress,
  visible = true,
  interestArt = null,
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      {(Array.isArray(events) ? events : []).map((e) => (
        <EventMarker
          key={`event-${e.id}`}
          e={e}
          onPress={onPress}
          interestArt={interestArt}
        />
      ))}
    </>
  );
}

export function MyLocationMarker({ coordinate }) {
  if (
    !coordinate ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude)
  ) {
    return null;
  }
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }}>
      <Pin color={colors.primary} size={44}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            backgroundColor: colors.primaryText,
          }}
        />
      </Pin>
    </Marker>
  );
}
