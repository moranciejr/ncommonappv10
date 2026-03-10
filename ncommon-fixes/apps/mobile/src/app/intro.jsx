import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/utils/auth";
import { darkTheme } from "@/utils/theme";

const { width, height } = Dimensions.get("window");
const { colors, spacing, typography, radius } = darkTheme;

const SLIDES = [
  { id: 1, type: "emotion" },
  { id: 2, type: "map" },
  { id: 3, type: "interests" },
  { id: 4, type: "action" },
];

export default function IntroScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { signUp, signIn, isAuthenticated, isReady } = useAuth();

  // Returning user — skip slides, show sign-in immediately
  const isReturning = params?.returning === "1";
  useEffect(() => {
    if (isReturning) {
      signIn();
    }
  }, [isReturning, signIn]);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: width * nextIndex,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    } else {
      // Mark intro as done
      await AsyncStorage.setItem("nc_intro_done", "1");

      // If already authenticated, go to onboarding
      // Otherwise, open sign up modal
      if (isReady && isAuthenticated) {
        router.replace("/onboarding");
      } else {
        signUp();
      }
    }
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        decelerationRate="fast"
        style={{ flexGrow: 0 }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={{ width, height }}>
            {slide.type === "emotion" && (
              <Slide1Emotion insets={insets} onNext={handleNext} />
            )}
            {slide.type === "map" && (
              <Slide2Map insets={insets} onNext={handleNext} />
            )}
            {slide.type === "interests" && (
              <Slide3Interests insets={insets} onNext={handleNext} />
            )}
            {slide.type === "action" && (
              <Slide4Action insets={insets} onNext={handleNext} />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots - positioned between content and buttons on all slides */}
      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 140,
          alignSelf: "center",
          flexDirection: "row",
          gap: spacing.sm,
        }}
      >
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={{
              width: spacing.sm,
              height: spacing.sm,
              borderRadius: spacing.xs,
              backgroundColor:
                index === currentIndex
                  ? colors.yellow
                  : "rgba(255, 255, 255, 0.3)",
            }}
          />
        ))}
      </View>
    </View>
  );
}


// ─────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────

function CTAButton({ onPress, label }) {
  const [pressed, setPressed] = useState(false);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      activeOpacity={0.9}
      style={{
        backgroundColor: colors.yellow,
        paddingVertical: 18,
        borderRadius: radius.md,
        alignItems: "center",
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#000" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Pulsing map pin used on slide 2
function MapPin({ x, y, delay = 0, active = false }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          ])
        ).start();
      });
    }, delay);
  }, [delay, fadeAnim, pulseAnim]);

  const pinColor = active ? colors.yellow : colors.primary;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - 14,
        top: y - 14,
        opacity: fadeAnim,
        transform: [{ scale: pulseAnim }],
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: pinColor,
          borderWidth: 2.5,
          borderColor: active ? "#FFF" : "rgba(255,255,255,0.4)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? "#000" : "#FFF" }} />
      </View>
      {/* Glow ring */}
      <View
        style={{
          position: "absolute",
          top: -6, left: -6,
          width: 40, height: 40,
          borderRadius: 20,
          backgroundColor: pinColor,
          opacity: 0.2,
        }}
      />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// SLIDE 1 — Hook: real people nearby right now
// User feels: "Oh, there are actual people here"
// ─────────────────────────────────────────────
function Slide1Emotion({ insets, onNext }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const card1 = useRef(new Animated.Value(0)).current;
  const card2 = useRef(new Animated.Value(0)).current;
  const card3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(220, [
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(card1, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card2, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(card3, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [card1, card2, card3, fadeAnim]);

  const cardAnim = (anim) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  const PEOPLE = [
    { emoji: "🏓", bg: "rgba(57,217,138,0.2)", name: "Sam, 26", tag: "Pickleball • 0.3 mi", align: "flex-start" },
    { emoji: "🎸", bg: "rgba(139,92,246,0.25)", name: "Maya, 24", tag: "Live music • 0.7 mi", align: "flex-end" },
    { emoji: "☕", bg: "rgba(251,146,60,0.2)", name: "Jordan, 29", tag: "Coffee spots • 0.4 mi", align: "flex-start" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Atmosphere */}
      <View style={{
        position: "absolute", top: -60, left: width * 0.5 - 180,
        width: 360, height: 360, borderRadius: 180,
        backgroundColor: "rgba(139,92,246,0.6)",
      }} />
      <View style={{
        position: "absolute", bottom: "30%", right: -80,
        width: 220, height: 220, borderRadius: 110,
        backgroundColor: "rgba(45,212,191,0.07)",
      }} />

      {/* "3 people nearby right now" label */}
      <Animated.View style={[{
        position: "absolute",
        top: insets.top + spacing.lg,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        backgroundColor: "rgba(26,31,46,0.9)",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }, { opacity: fadeAnim }]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" }} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
          3 people free right now
        </Text>
      </Animated.View>

      {/* Person cards staggered in */}
      <View style={{
        position: "absolute",
        top: insets.top + 76,
        left: 0, right: 0,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
      }}>
        {PEOPLE.map((p, i) => {
          const anim = [card1, card2, card3][i];
          return (
            <Animated.View key={i} style={[{ alignSelf: p.align }, cardAnim(anim)]}>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingVertical: 10,
                paddingLeft: 10,
                paddingRight: 18,
              }}>
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: p.bg,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                }}>
                  <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "500", color: colors.subtext, marginTop: 2 }}>{p.tag}</Text>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Bottom gradient + content */}
      <LinearGradient
        colors={["transparent", colors.background]}
        locations={[0.0, 0.42]}
        style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: height * 0.56 }}
        pointerEvents="none"
      />
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + spacing["2xl"],
        opacity: fadeAnim,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: spacing.lg }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(242,244,248,0.4)", letterSpacing: 1.1, textTransform: "uppercase" }}>
            nCommon
          </Text>
        </View>

        <View style={{ marginBottom: spacing.base }}>
          <Text style={{ fontSize: 46, fontWeight: "800", color: colors.text, lineHeight: 50, letterSpacing: -1 }}>
            Your friends{"\n"}are busy.
          </Text>
          <Text style={{ fontSize: 38, fontWeight: "800", color: colors.yellow, lineHeight: 42, letterSpacing: -0.8, marginTop: 6 }}>
            These people aren't.
          </Text>
        </View>

        <Text style={{ fontSize: 16, color: colors.subtext, lineHeight: 24, marginBottom: spacing["2xl"] }}>
          nCommon finds people nearby who want to do something right now — not next week.
        </Text>

        <CTAButton onPress={onNext} label="See who's out there" />
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SLIDE 2 — Map: tap a pin, see the plan
// User feels: "I can see what's happening near me"
// ─────────────────────────────────────────────
function Slide2Map({ insets, onNext }) {
  const mapRef = useRef(null);
  const [pinTapped, setPinTapped] = useState(false);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const handlePinTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPinTapped(true);
    Animated.spring(cardAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0c10" }}>
      <MapView
        ref={mapRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        mapType="hybrid"
        initialRegion={{ latitude: 30.2672, longitude: -97.7431, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
        pitchEnabled={false} toolbarEnabled={false} loadingEnabled={false}
        showsUserLocation={false} showsMyLocationButton={false}
        showsCompass={false} showsScale={false} showsBuildings={true}
        showsTraffic={false} showsIndoors={false} showsPointsOfInterest={false}
      />
      <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.18)" }} />

      {/* Static background pins */}
      <MapPin x={width * 0.2}  y={height * 0.28} delay={200} />
      <MapPin x={width * 0.7}  y={height * 0.22} delay={400} />
      <MapPin x={width * 0.55} y={height * 0.42} delay={600} />
      <MapPin x={width * 0.3}  y={height * 0.50} delay={800} />

      {/* Tappable active pin */}
      <TouchableOpacity
        onPress={handlePinTap}
        activeOpacity={0.8}
        style={{ position: "absolute", left: width * 0.48, top: height * 0.34 }}
      >
        <MapPin x={14} y={14} delay={300} active />
        {!pinTapped && (
          <View style={{
            position: "absolute", top: -30, left: -28,
            backgroundColor: colors.yellow,
            paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 999,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#000" }}>Tap me</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Plan card that slides up on pin tap */}
      <Animated.View style={{
        position: "absolute",
        bottom: insets.bottom + 120,
        left: spacing.xl, right: spacing.xl,
        opacity: cardAnim,
        transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
      }}>
        <View style={{
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.lg,
          borderWidth: 1, borderColor: colors.border,
          padding: spacing.base,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: "rgba(57,217,138,0.2)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 20 }}>🏓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Pickleball at Zilker Park</Text>
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.subtext, marginTop: 2 }}>Sam, 26 · Starting in 20 mins</Text>
            </View>
            <View style={{ backgroundColor: colors.yellow, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#000" }}>Join</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: colors.subtext, lineHeight: 19 }}>
            "Looking for 1-2 more players, all levels welcome 🎉"
          </Text>
        </View>
      </Animated.View>

      {/* Top label */}
      <View style={{
        position: "absolute",
        top: insets.top + spacing.base,
        left: spacing.xl, right: spacing.xl,
      }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#FFF", lineHeight: 34, letterSpacing: -0.5 }}>
          See what people are{"\n"}doing right now.
        </Text>
        <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: spacing.sm, fontWeight: "500" }}>
          {pinTapped ? "Tap Join and you're in." : "Every pin is a real plan, happening today."}
        </Text>
      </View>

      {/* CTA */}
      <View style={{ position: "absolute", bottom: insets.bottom + spacing["2xl"], left: spacing.xl, right: spacing.xl }}>
        <CTAButton onPress={onNext} label="Next" />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SLIDE 3 — Interests: tap to pick yours
// User feels: "This is already personalising for me"
// ─────────────────────────────────────────────
function Slide3Interests({ insets, onNext }) {
  const INTERESTS = [
    { label: "Pickleball", emoji: "🏓" },
    { label: "Coffee", emoji: "☕" },
    { label: "Hiking", emoji: "🥾" },
    { label: "Live music", emoji: "🎸" },
    { label: "Sushi", emoji: "🍣" },
    { label: "Game night", emoji: "🎲" },
    { label: "Running", emoji: "🏃" },
    { label: "Sports bar", emoji: "🍺" },
    { label: "Reading", emoji: "📚" },
    { label: "Climbing", emoji: "🧗" },
    { label: "Brunch", emoji: "🥞" },
    { label: "Photography", emoji: "📷" },
  ];

  const [selected, setSelected] = useState(new Set());

  const toggle = (label) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const count = selected.size;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: insets.top + spacing.base,
        paddingBottom: insets.bottom + spacing["2xl"],
        justifyContent: "space-between",
      }}>
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -0.5, lineHeight: 40 }}>
            What do you{"\n"}want to do today?
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.subtext, marginTop: spacing.sm, lineHeight: 22 }}>
            {count === 0
              ? "Pick what you're into. We'll find someone doing it."
              : count === 1
              ? "Good start. A few more helps us find the right people."
              : `${count} interests — we'll find people doing these today.`}
          </Text>
        </View>

        {/* Chip grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {INTERESTS.map(({ label, emoji }) => {
            const active = selected.has(label);
            return (
              <TouchableOpacity
                key={label}
                onPress={() => toggle(label)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  borderRadius: 999,
                  backgroundColor: active ? colors.yellow : colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: active ? colors.yellow : colors.border,
                }}
              >
                <Text style={{ fontSize: 17 }}>{emoji}</Text>
                <Text style={{
                  fontSize: 14, fontWeight: "600",
                  color: active ? "#000" : colors.text,
                }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <CTAButton
          onPress={onNext}
          label={count === 0 ? "Skip for now" : "Looks good →"}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// SLIDE 4 — Match: here's someone for you
// User feels: "Someone is actually waiting — I should sign up"
// ─────────────────────────────────────────────
function Slide4Action({ insets, onNext }) {
  const cardAnim = useRef(new Animated.Value(0)).current;
  const msgAnim = useRef(new Animated.Value(0)).current;
  const [sent, setSent] = useState(false);

  useEffect(() => {
    Animated.timing(cardAnim, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
  }, [cardAnim]);

  const handleJoin = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
    Animated.spring(msgAnim, { toValue: 1, tension: 55, friction: 10, useNativeDriver: true }).start();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Atmosphere */}
      <View style={{
        position: "absolute", top: -40, right: -80,
        width: 280, height: 280, borderRadius: 140,
        backgroundColor: "rgba(139,92,246,0.5)",
      }} />

      <View style={{
        flex: 1, paddingHorizontal: spacing.xl,
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing["2xl"],
        justifyContent: "space-between",
      }}>
        <View>
          <Text style={{ fontSize: 34, fontWeight: "800", color: colors.text, letterSpacing: -0.5, lineHeight: 40 }}>
            Sam has a spot.{"\n"}Right now.
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "500", color: colors.subtext, marginTop: spacing.sm, lineHeight: 22 }}>
            You could be there in 20 minutes. This is what nCommon is for.
          </Text>
        </View>

        {/* Profile match card */}
        <Animated.View style={{
          opacity: cardAnim,
          transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        }}>
          <View style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: radius.xl,
            borderWidth: 1, borderColor: colors.border,
            overflow: "hidden",
          }}>
            {/* Hero area */}
            <View style={{
              height: 160,
              backgroundColor: "rgba(139,92,246,0.6)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 64 }}>🏓</Text>
              <View style={{
                position: "absolute", top: spacing.base, left: spacing.base,
                backgroundColor: colors.yellow,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#000" }}>Starts in 18 mins</Text>
              </View>
            </View>

            {/* Card body */}
            <View style={{ padding: spacing.base }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>Sam, 26</Text>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: colors.subtext, marginTop: 2 }}>Pickleball · Zilker Park · 0.3 mi</Text>
                </View>
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: "rgba(57,217,138,0.2)",
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: "rgba(57,217,138,0.3)",
                }}>
                  <Text style={{ fontSize: 22 }}>🏓</Text>
                </View>
              </View>

              <Text style={{ fontSize: 13, color: colors.subtext, lineHeight: 19, marginBottom: spacing.base }}>
                "Looking for 1-2 more players, all levels welcome 🎉"
              </Text>

              {/* Actions */}
              {!sent ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={handleJoin}
                    activeOpacity={0.85}
                    style={{
                      flex: 1, paddingVertical: 13,
                      backgroundColor: colors.yellow,
                      borderRadius: radius.md,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#000" }}>Request to join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={{
                      paddingVertical: 13, paddingHorizontal: spacing.base,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.subtext }}>💬</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Animated.View style={{
                  opacity: msgAnim,
                  transform: [{ scale: msgAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                  backgroundColor: "rgba(57,217,138,0.12)",
                  borderWidth: 1, borderColor: "rgba(57,217,138,0.3)",
                  borderRadius: radius.md,
                  paddingVertical: 13, alignItems: "center",
                }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#34D399" }}>
                    ✓ Requested — sign up so Sam can see you
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>

        <CTAButton onPress={onNext} label="Create your account →" />
      </View>
    </View>
  );
}
