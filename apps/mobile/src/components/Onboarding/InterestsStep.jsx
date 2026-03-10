import { Text, TextInput, View } from "react-native";
import { Chip } from "./Chip";
import { clampText } from "@/utils/dateValidation";

export function InterestsStep({
  interestSearch,
  setInterestSearch,
  searchResults,
  groupedTaxonomy,
  interests,
  toggleInterest,
  selectedLabels,
  handleInputFocus,
  handleInputBlur,
}) {
  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: "#2D114D",
            marginBottom: 6,
          }}
        >
          Search
        </Text>
        <TextInput
          value={interestSearch}
          onChangeText={(t) => setInterestSearch(clampText(t, 80))}
          placeholder="Try: sushi, yoga, karaoke…"
          placeholderTextColor="#9A9AA0"
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          style={{
            borderWidth: 1,
            borderColor: "#E6E6E6",
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 46,
            backgroundColor: "#FFFFFF",
            color: "#111111",
            fontSize: 15,
          }}
        />
      </View>

      {interestSearch.trim() ? (
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: "#8A8A8A" }}>
            Results ({searchResults.length})
          </Text>
        </View>
      ) : null}

      {interestSearch.trim() ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {searchResults.map((it) => {
            const selected = interests.includes(it.value);
            return (
              <Chip
                key={`${it.category}::${it.value}`}
                label={it.label}
                selected={selected}
                onPress={() => toggleInterest(it.value)}
              />
            );
          })}
          {!searchResults.length ? (
            <Text style={{ color: "#5F5F5F", fontWeight: "700" }}>
              No matches. Try a different search.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {groupedTaxonomy.map((group) => (
            <View key={group.id}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "900",
                  color: "#1C1230",
                  marginBottom: 8,
                }}
              >
                {group.label}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {group.items.map((it) => {
                  const selected = interests.includes(it.value);
                  return (
                    <Chip
                      key={`${group.id}::${it.value}`}
                      label={it.label}
                      selected={selected}
                      onPress={() => toggleInterest(it.value)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: "#5F5F5F", fontSize: 12, lineHeight: 16 }}>
          Selected ({interests.length}/10): {selectedLabels}
        </Text>
      </View>
    </View>
  );
}
