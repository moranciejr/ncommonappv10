import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, Lock } from "lucide-react-native";
import { darkTheme, spacing, typography } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { ToggleRow } from "./ToggleRow";
import { OptionRow } from "./OptionRow";
import authedFetch from "@/utils/authedFetch";

const DEV_MODE_KEY = "appSettings:devMode";

export function AlertsSection({
  isFree,
  settings,
  savingProfileSettings,
  quietPreset,
  onUpgradePress,
  toggleNotifPlanViews,
  toggleNotifNearbyPlans,
  toggleNotifJoinRequests,
  toggleNotifRequestUpdates,
  toggleNotifMessages,
  setQuietHoursPreset,
}) {
  // Secret gesture: tap the "Alerts" header 7 times to toggle dev tools.
  const devFlag = useMemo(() => {
    const isDev =
      typeof globalThis !== "undefined" && globalThis
        ? Boolean(globalThis.__DEV__)
        : false;
    return isDev;
  }, []);

  const [devMode, setDevMode] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
        if (!mounted) return;
        setDevMode(stored === "1");
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      mounted = false;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, []);

  const showDevTools = devFlag || devMode;

  const onHeaderTap = useCallback(async () => {
    tapCountRef.current += 1;

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1200);

    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      const next = !devMode;
      setDevMode(next);
      try {
        await AsyncStorage.setItem(DEV_MODE_KEY, next ? "1" : "0");
      } catch (err) {
        console.error(err);
      }
    }
  }, [devMode]);

  const [testStatus, setTestStatus] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const sendTestPush = useCallback(async () => {
    setTestStatus(null);
    setTestLoading(true);

    try {
      const response = await authedFetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test push",
          body: "If you see this, push notifications are working.",
          force: false,
          data: { type: "debug_test" },
        }),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          typeof json?.error === "string" && json.error
            ? json.error
            : `Server error (${response.status})`;
        setTestStatus(msg);
        return;
      }

      const reason = json?.result?.reason;
      const sent = json?.result?.sent;

      if (reason === "no_tokens") {
        setTestStatus("No active push token registered on this device yet.");
        return;
      }

      if (reason === "quiet_hours") {
        setTestStatus("Test push suppressed by quiet hours.");
        return;
      }

      const sentNum = typeof sent === "number" ? sent : 0;
      setTestStatus(sentNum > 0 ? "Test push sent." : "Test push queued.");
    } catch (err) {
      console.error(err);
      const msg =
        typeof err?.message === "string" && err.message
          ? err.message
          : "Could not send test push";
      setTestStatus(msg);
    } finally {
      setTestLoading(false);
    }
  }, []);

  const planViewAlertsSubtitle = useMemo(() => {
    if (isFree) {
      return "Upgrade to Plus to get notified when someone views your plan pin.";
    }
    return "When someone views your plan pin, you'll get an alert.";
  }, [isFree]);

  const planViewAlertsHint = useMemo(() => {
    if (isFree) return "Plus";
    return settings.notifPlanViews ? "On" : "Off";
  }, [isFree, settings.notifPlanViews]);

  return (
    <View style={{ marginTop: spacing.md }}>
      <TouchableOpacity onPress={onHeaderTap} activeOpacity={0.9}>
        <Text style={{ ...typography.body.lgBold, color: colors.text }}>
          Alerts
        </Text>
      </TouchableOpacity>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <ToggleRow
          title="Nearby plan alerts"
          subtitle="Get notified when someone nearby posts a plan that starts soon (based on your interests)."
          value={settings.notifNearbyPlans}
          disabled={savingProfileSettings}
          onValueChange={toggleNotifNearbyPlans}
        />

        <TouchableOpacity
          onPress={() => {
            if (isFree) {
              onUpgradePress();
              return;
            }
            toggleNotifPlanViews(!settings.notifPlanViews);
          }}
          activeOpacity={0.95}
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.md,
            ...shadow.card,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {isFree ? (
              <Lock size={18} color={colors.yellow} />
            ) : (
              <Check size={18} color={colors.yellow} />
            )}
            <Text
              style={{ flex: 1, ...typography.body.mdBold, color: colors.text }}
            >
              Plan view alerts
            </Text>
            <Text style={{ ...typography.body.mdBold, color: colors.subtext }}>
              {planViewAlertsHint}
            </Text>
          </View>
          <Text
            style={{
              marginTop: spacing.sm,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            {planViewAlertsSubtitle}
          </Text>

          {isFree ? (
            <Text
              style={{
                marginTop: spacing.sm,
                color: colors.yellow,
                ...typography.body.mdBold,
              }}
            >
              Upgrade to enable
            </Text>
          ) : null}
        </TouchableOpacity>

        <ToggleRow
          title="Join request alerts"
          subtitle={'Get notified when someone taps "I\'m in" on your plan.'}
          value={settings.notifJoinRequests}
          disabled={savingProfileSettings}
          onValueChange={toggleNotifJoinRequests}
        />

        <ToggleRow
          title="Request updates"
          subtitle="Get notified when your request is accepted/declined/cancelled."
          value={settings.notifRequestUpdates}
          disabled={savingProfileSettings}
          onValueChange={toggleNotifRequestUpdates}
        />

        <ToggleRow
          title="Message alerts"
          subtitle="Get a notification when someone messages you."
          value={settings.notifMessages}
          disabled={savingProfileSettings}
          onValueChange={toggleNotifMessages}
        />

        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: spacing.md,
            ...shadow.card,
          }}
        >
          <Text style={{ ...typography.body.mdBold, color: colors.text }}>
            Quiet hours
          </Text>
          <Text
            style={{
              marginTop: spacing.xs,
              color: colors.subtext,
              ...typography.body.smBold,
              lineHeight: 18,
            }}
          >
            Used for push notifications later. For now it's saved here so we can
            turn on real pushes without changing your settings again.
          </Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <OptionRow
              title="Off"
              subtitle="No quiet hours"
              selected={quietPreset === "none"}
              onPress={() => setQuietHoursPreset("none")}
            />
            <OptionRow
              title="10pm – 8am"
              subtitle="Recommended"
              selected={quietPreset === "night"}
              onPress={() => setQuietHoursPreset("night")}
            />
            <OptionRow
              title="11pm – 7am"
              subtitle={quietPreset === "late" ? "Current" : null}
              selected={quietPreset === "late"}
              onPress={() => setQuietHoursPreset("late")}
            />
          </View>

          {quietPreset === "custom" ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text
                style={{ color: colors.subtext, ...typography.body.smBold }}
              >
                You currently have a custom quiet window (
                {settings.quietHoursStart}:00–{settings.quietHoursEnd}:00). We
                can add a custom picker next.
              </Text>
            </View>
          ) : null}
        </View>

        {showDevTools ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.xl,
              padding: spacing.md,
              ...shadow.card,
            }}
          >
            <Text style={{ ...typography.body.mdBold, color: colors.text }}>
              Developer
            </Text>
            <Text
              style={{
                marginTop: spacing.xs,
                color: colors.subtext,
                ...typography.body.smBold,
                lineHeight: 18,
              }}
            >
              Send a test push to this device to validate registration +
              delivery.
            </Text>

            <TouchableOpacity
              onPress={sendTestPush}
              disabled={testLoading}
              activeOpacity={0.9}
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.text,
                borderRadius: radii.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text
                style={{
                  color: colors.background,
                  ...typography.body.mdBold,
                  textAlign: "center",
                }}
              >
                {testLoading ? "Sending…" : "Send test push"}
              </Text>
            </TouchableOpacity>

            {testStatus ? (
              <Text
                style={{
                  marginTop: spacing.sm,
                  color: colors.subtext,
                  ...typography.body.smBold,
                  lineHeight: 18,
                }}
              >
                {testStatus}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
