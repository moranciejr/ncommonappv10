import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { colors, radii } from "@/utils/theme";
import { MessageBubble } from "./MessageBubble";
import { QuickStartersSection } from "./QuickStartersSection";
import { IcebreakersSection } from "./IcebreakersSection";

export function MessagesList({
  messages,
  currentUserId,
  isLoading,
  errorMessage,
  shouldShowQuickStarters,
  quickStarterTitle,
  quickStarters,
  shouldShowIcebreakers,
  icebreakers,
  onSelectStarter,
  // NEW: tone toggle for starters (only shown for empty chats)
  tone,
  onToneChange,
  // NEW: pull-to-refresh
  refreshControl,
}) {
  const showToneToggle =
    !isLoading &&
    messages.length === 0 &&
    (shouldShowQuickStarters || shouldShowIcebreakers) &&
    typeof onToneChange === "function";

  const toneOptions = [
    { id: "chill", label: "Chill" },
    { id: "funny", label: "Funny" },
    { id: "direct", label: "Direct" },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={refreshControl}
      contentContainerStyle={{
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 16,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showToneToggle ? (
        <View
          style={{
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text
            style={{ fontSize: 12, fontWeight: "900", color: colors.subtext }}
          >
            Tone
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {toneOptions.map((opt) => {
              const selected = opt.id === tone;
              const bg = selected ? colors.chipBg : "rgba(0,0,0,0.035)";
              const textColor = selected ? colors.primary : colors.subtext;
              const borderColor = selected
                ? "rgba(45,17,77,0.18)"
                : colors.border;

              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => onToneChange(opt.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: bg,
                    borderWidth: 1,
                    borderColor,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "900",
                      color: textColor,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {shouldShowQuickStarters ? (
        <QuickStartersSection
          title={quickStarterTitle}
          starters={quickStarters}
          onSelect={onSelectStarter}
        />
      ) : null}

      {shouldShowIcebreakers ? (
        <IcebreakersSection
          icebreakers={icebreakers}
          onSelect={onSelectStarter}
        />
      ) : null}

      {errorMessage ? (
        <View
          style={{
            marginBottom: 12,
            backgroundColor: colors.dangerBg,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "rgba(176,0,32,0.12)",
          }}
        >
          <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {messages.map((m) => {
            const mine =
              (typeof currentUserId === "number" &&
                m.sender_user_id === currentUserId) ||
              m.sender_user_id === -1;

            return (
              <MessageBubble key={String(m.id)} message={m} isMine={mine} />
            );
          })}

          {!messages.length ? (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.96)",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.card,
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: colors.primary,
                }}
              >
                Say hi
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.subtext,
                  lineHeight: 18,
                }}
              >
                Keep it respectful — nCommon blocks solicitation.
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
