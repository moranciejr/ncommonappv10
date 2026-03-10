import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { darkTheme } from "@/utils/theme";

const { colors, radius: radii, shadow } = darkTheme;
import { trackCrash } from "@/utils/analytics";

// Note: React error boundaries must be class-based.
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep logging simple; if you later add Sentry/etc this is the place.
    console.error("AppErrorBoundary caught error", error, info);

    // Fire-and-forget crash reporting (never blocks UX).
    trackCrash(error, {
      componentStack: info?.componentStack || "",
      source: "AppErrorBoundary",
    }).catch(() => null);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = process.env.NODE_ENV === "development";

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.xl,
            padding: 16,
            ...shadow.card,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: colors.text,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 13,
              fontWeight: "700",
              color: colors.subtext,
              lineHeight: 18,
            }}
          >
            Try again. If it keeps happening, update the app or reinstall.
          </Text>

          {/* Show error details in development */}
          {isDev && this.state.error && (
            <View
              style={{
                marginTop: 12,
                padding: 8,
                backgroundColor: "#1a1a1a",
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 11, color: "#ff6b6b" }}>
                {this.state.error.toString()}
              </Text>
              {this.state.error.stack && (
                <Text style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
                  {this.state.error.stack.slice(0, 500)}
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 14,
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: radii.lg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.primaryText,
                fontWeight: "900",
                fontSize: 14,
              }}
            >
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}
