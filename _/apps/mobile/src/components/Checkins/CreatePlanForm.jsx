import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useMemo } from "react";
import PlaceAutocompleteInput from "@/components/PlaceAutocompleteInput";
import { InterestSelector } from "./InterestSelector";
import { GroupSizeSelector } from "./GroupSizeSelector";
import { GenderSelector } from "./GenderSelector";
import { ActivePlansList } from "./ActivePlansList";
import { Chip } from "./Chip";
import { colors, radii, shadow } from "@/utils/theme";
import { clampText } from "@/utils/textUtils";

export function CreatePlanForm({
  interests,
  selectedInterest,
  onSelectInterest,
  locationName,
  onLocationNameChange,
  deviceCoords,
  onPlacePick,
  note,
  onNoteChange,
  groupSizeOptions,
  desiredGroupSize,
  onSelectGroupSize,
  desiredGender,
  onSelectGender,
  startOffsetMinutes,
  onSelectStartOffset,
  onSubmit,
  isSubmitting,
  myActivePlans,
  myActiveCount,
  onEndPlan,
  isEnding,
  expiresLabel,
}) {
  const startOptions = useMemo(() => [0, 15, 30, 60, 120], []);

  const safeOffset =
    typeof startOffsetMinutes === "number" &&
    Number.isFinite(startOffsetMinutes)
      ? Math.max(0, Math.min(24 * 60, Math.round(startOffsetMinutes)))
      : 0;

  const startDate = useMemo(() => {
    return new Date(Date.now() + safeOffset * 60 * 1000);
  }, [safeOffset]);

  const startClock = useMemo(() => {
    try {
      return startDate.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [startDate]);

  const whenSummary = useMemo(() => {
    if (!startClock) {
      return "";
    }

    if (safeOffset <= 1) {
      return `Starts now • ${startClock}`;
    }

    const suffix = safeOffset === 1 ? "min" : "mins";
    return `Starts at ${startClock} • in ~${safeOffset} ${suffix}`;
  }, [safeOffset, startClock]);

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: colors.card,
        borderRadius: radii.card,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadow.card,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
        Create a plan
      </Text>

      {myActiveCount ? (
        <Text
          style={{
            marginTop: 8,
            fontSize: 13,
            color: colors.subtext,
            lineHeight: 18,
            fontWeight: "700",
          }}
        >
          You have {myActiveCount} active plan
          {myActiveCount === 1 ? "" : "s"}.
        </Text>
      ) : null}

      <InterestSelector
        interests={interests}
        selectedInterest={selectedInterest}
        onSelectInterest={onSelectInterest}
      />

      <View style={{ marginTop: 10 }}>
        <PlaceAutocompleteInput
          label="Place"
          value={locationName}
          onChangeValue={(t) => {
            onLocationNameChange(t);
          }}
          placeholder="Type a place (e.g. Medici Coffee)"
          biasCoords={deviceCoords}
          helperText="Pick a place so people nearby can join you."
          onPick={onPlacePick}
        />
      </View>

      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "900",
            color: colors.subtext,
          }}
        >
          When
        </Text>

        <ScrollView
          horizontal
          style={{ flexGrow: 0, marginTop: 8 }}
          showsHorizontalScrollIndicator={false}
        >
          {startOptions.map((mins) => {
            const label =
              mins === 0
                ? "Now"
                : mins === 60
                  ? "1h"
                  : mins === 120
                    ? "2h"
                    : `${mins}m`;

            return (
              <Chip
                key={mins}
                label={label}
                selected={safeOffset === mins}
                onPress={() => onSelectStartOffset?.(mins)}
              />
            );
          })}
        </ScrollView>

        {whenSummary ? (
          <Text
            style={{
              marginTop: 6,
              fontSize: 12,
              fontWeight: "800",
              color: colors.text,
            }}
          >
            {whenSummary}
          </Text>
        ) : null}

        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: colors.subtext,
            fontWeight: "700",
          }}
        >
          This is the start time people will see (and what we notify nearby
          people about).
        </Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "900",
            color: colors.subtext,
          }}
        >
          What are you down to do?
        </Text>
        <TextInput
          value={note}
          onChangeText={(t) => onNoteChange(clampText(t, 280))}
          placeholder="Coffee + talk business, pickup basketball, study session…"
          placeholderTextColor="#98A2B3"
          style={{
            marginTop: 8,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 46,
            backgroundColor: "#FFFFFF",
            color: colors.text,
            fontSize: 15,
          }}
        />
      </View>

      <GroupSizeSelector
        groupSizeOptions={groupSizeOptions}
        desiredGroupSize={desiredGroupSize}
        onSelectGroupSize={onSelectGroupSize}
      />

      <GenderSelector
        desiredGender={desiredGender}
        onSelectGender={onSelectGender}
      />

      <TouchableOpacity
        onPress={onSubmit}
        disabled={isSubmitting}
        style={{
          marginTop: 12,
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: radii.button,
          alignItems: "center",
          opacity: isSubmitting ? 0.6 : 1,
          ...shadow.card,
        }}
      >
        <Text
          style={{
            color: colors.primaryText,
            fontSize: 16,
            fontWeight: "900",
          }}
        >
          {isSubmitting ? "Posting…" : "Post plan"}
        </Text>
      </TouchableOpacity>

      <ActivePlansList
        plans={myActivePlans}
        onEndPlan={onEndPlan}
        isEnding={isEnding}
      />

      <Text
        style={{
          marginTop: 10,
          fontSize: 12,
          color: colors.subtext,
          fontWeight: "700",
        }}
      >
        Plans expire automatically ({expiresLabel}).
      </Text>
    </View>
  );
}
