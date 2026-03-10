import { Text, TouchableOpacity, View } from "react-native";
import { colorForInterest } from "@/utils/formatUtils";
import { getInterestLabel } from "@/utils/interestTaxonomy";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;

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

function formatDesiredGroupSize(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    return null;
  }
  if (n === 1) {
    return "1 person";
  }
  return `${n} people`;
}

export function UsersList({
  users,
  selectedUserId,
  onUserPress,
  onUserLongPress,
  getCtaForPlan,
}) {
  const hasUsers = users.length > 0;

  if (!hasUsers) {
    return (
      <View
        style={{
          marginTop: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.xl,
          padding: 14,
          ...shadow.card,
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          No plans yet
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.subtext,
            fontWeight: "700",
            lineHeight: 18,
          }}
        >
          Post what you’re in the mood to do — it shows up here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10, gap: 10 }}>
      {users.slice(0, 16).map((u) => {
        const isSelected = selectedUserId === u.id;
        const dot = colorForInterest(u.interest);
        const label = getInterestLabel(u.interest) || u.interest;
        const borderColor = isSelected ? "rgba(139,92,246,0.22)" : colors.border;

        const cta =
          typeof getCtaForPlan === "function" ? getCtaForPlan(u) : null;
        const ctaTitle = cta?.title || null;
        const ctaDisabled = !!cta?.disabled;
        const onCtaPress =
          typeof cta?.onPress === "function" ? cta.onPress : null;

        const name = u.displayName || "Someone";
        const initials = initialsFromName(name);

        const sizeText = formatDesiredGroupSize(u.desiredGroupSize);
        const sublineParts = [label];
        if (sizeText) {
          sublineParts.push(`wants ${sizeText}`);
        }
        if (u.locationName) {
          sublineParts.push(u.locationName);
        }
        const subline = sublineParts.filter(Boolean).join(" · ");

        const notePreview =
          typeof u.note === "string" && u.note.trim() ? u.note.trim() : null;

        const showCta =
          typeof ctaTitle === "string" && ctaTitle.trim().length > 0;

        return (
          <View
            key={`sheet-user-${u.id}`}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor,
              borderRadius: 18,
              overflow: "hidden",
              ...shadow.card,
            }}
          >
            <TouchableOpacity
              onPress={() => onUserPress(u)}
              onLongPress={() => onUserLongPress?.(u)}
              delayLongPress={350}
              activeOpacity={0.92}
              style={{ padding: 14 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: colors.text }}>
                    {initials}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "900",
                        color: colors.text,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                  </View>

                  <View
                    style={{
                      marginTop: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        backgroundColor: dot,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.subtext,
                        fontWeight: "800",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {subline}
                    </Text>
                  </View>

                  {notePreview ? (
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: colors.text,
                        fontWeight: "700",
                        lineHeight: 16,
                      }}
                      numberOfLines={2}
                    >
                      {notePreview}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>

            {showCta ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <TouchableOpacity
                  onPress={onCtaPress}
                  disabled={!onCtaPress || ctaDisabled}
                  style={{
                    backgroundColor: ctaDisabled
                      ? colors.surfaceElevated
                      : colors.primary,
                    borderRadius: radii.lg,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: ctaDisabled ? colors.border : colors.primary,
                    opacity: ctaDisabled ? 0.75 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: ctaDisabled ? colors.text : colors.primaryText,
                      fontWeight: "900",
                      fontSize: 14,
                    }}
                  >
                    {ctaTitle}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
