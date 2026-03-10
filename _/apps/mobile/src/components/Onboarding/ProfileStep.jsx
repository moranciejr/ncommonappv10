import { Text, View, Switch } from "react-native";
import { Input } from "./Input";
import { clampText } from "@/utils/dateValidation";

export function ProfileStep({
  displayName,
  setDisplayName,
  dobText,
  setDobText,
  bio,
  setBio,
  city,
  setCity,
  stateName,
  setStateName,
  showAge,
  setShowAge,
  handleInputFocus,
  handleInputBlur,
}) {
  return (
    <View>
      <Input
        label="Display name"
        value={displayName}
        onChangeText={(t) => setDisplayName(clampText(t, 80))}
        placeholder="What should people call you?"
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />

      <Input
        label="Date of birth (18+ only)"
        value={dobText}
        onChangeText={(t) => setDobText(clampText(t, 24))}
        placeholder="MM/DD/YYYY"
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />

      <View
        style={{
          marginTop: 2,
          marginBottom: 12,
          backgroundColor: "#F7F5FF",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: "rgba(45,17,77,0.12)",
        }}
      >
        <Text style={{ fontSize: 12, color: "#2D114D", fontWeight: "900" }}>
          DOB stays private
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "#5F5F5F",
            fontWeight: "700",
            lineHeight: 16,
          }}
        >
          We use it for safety and to confirm you’re an adult. Your age only
          shows if you turn it on.
        </Text>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "900",
                color: "#1C1230",
              }}
            >
              Show my age on my profile (optional)
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 12,
                fontWeight: "700",
                color: "#5F5F5F",
              }}
            >
              Off by default.
            </Text>
          </View>
          <Switch value={showAge} onValueChange={setShowAge} />
        </View>
      </View>

      <Input
        label="Bio (optional)"
        value={bio}
        onChangeText={(t) => setBio(clampText(t, 500))}
        placeholder="A quick line about what you're into"
        multiline
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Input
            label="City (optional)"
            value={city}
            onChangeText={(t) => setCity(clampText(t, 120))}
            placeholder="Austin"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </View>
        <View style={{ width: 110 }}>
          <Input
            label="State (optional)"
            value={stateName}
            onChangeText={(t) => setStateName(clampText(t, 120))}
            placeholder="TX"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
        </View>
      </View>
      <Text style={{ fontSize: 12, color: "#8A8A8A", lineHeight: 16 }}>
        Tip: keep it real. Spammy names or weird symbols are filtered on the
        server.
      </Text>
    </View>
  );
}
