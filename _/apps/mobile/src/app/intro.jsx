import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
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
  {
    id: 1,
    type: "emotion",
    backgroundImage:
      "https://raw.createusercontent.com/c96890a6-3a8d-4d53-aa3a-b1dc790957a3/",
  },
  {
    id: 2,
    type: "map",
    headline: "See what's happening near you.",
    subtext: "Check-ins and plans, live on the map.",
  },
  {
    id: 3,
    type: "interests",
    headline: "Same interests. No guessing.",
    subtext:
      "We match you with friends you actually have things nCommon with — right now.",
  },
  {
    id: 4,
    type: "action",
    headline: "Make it happen.",
    subtext: "Post it. Invite people. Lock it in.",
  },
];

export default function IntroScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, isAuthenticated, isReady } = useAuth();

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
              <Slide1Emotion
                slide={slide}
                insets={insets}
                onNext={handleNext}
              />
            )}
            {slide.type === "map" && (
              <Slide2Map slide={slide} insets={insets} onNext={handleNext} />
            )}
            {slide.type === "interests" && (
              <Slide3Interests
                slide={slide}
                insets={insets}
                onNext={handleNext}
              />
            )}
            {slide.type === "action" && (
              <Slide4Action slide={slide} insets={insets} onNext={handleNext} />
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

// SLIDE 1 - EMOTIONAL HOOK WITH FULL SCREEN IMAGE
function Slide1Emotion({ slide, insets, onNext }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Full-screen background image */}
      <Image
        source={{ uri: slide.backgroundImage }}
        style={StyleSheet.absoluteFill}
        contentFit="fill"
        contentPosition="center"
        transition={100}
      />

      {/* Stronger dark gradient overlay - starts at 30%, goes to 75% opacity at bottom */}
      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.75)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Content overlaid on top */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.base,
          paddingBottom: insets.bottom + spacing["2xl"],
          justifyContent: "space-between",
        }}
      >
        {/* Empty top spacer for consistent layout */}
        <View />

        {/* Bottom content */}
        <View>
          {/* Headline */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 44,
                fontWeight: "700",
                color: "#FFFFFF",
                lineHeight: 48,
              }}
            >
              Do anything.
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#F5C842",
                lineHeight: 30,
                marginTop: 8,
              }}
            >
              Just don't do it alone.
            </Text>
          </View>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "400",
              color: "rgba(255, 255, 255, 0.90)",
              lineHeight: 24,
              marginBottom: spacing["2xl"],
            }}
          >
            Make friends you actually have things nCommon with.
          </Text>

          {/* CTA Button - same as other slides */}
          <CTAButton onPress={onNext} label="Get Started" />
        </View>
      </View>
    </View>
  );
}

// SLIDE 2 - PRODUCT (MAP ONLY)
function Slide2Map({ slide, insets, onNext }) {
  const mapRef = useRef(null);

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0c10" }}>
      {/* Real MapView with satellite imagery - centered on Austin */}
      <MapView
        ref={mapRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        mapType="hybrid"
        initialRegion={{
          latitude: 30.2672,
          longitude: -97.7431,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        loadingEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={true}
        showsTraffic={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
      />

      {/* Subtle dark overlay for text contrast */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.2)",
        }}
      />

      {/* Map pins - 6-8 pins scattered */}
      <View
        style={{
          position: "absolute",
          top: height * 0.3,
          left: 0,
          right: 0,
          height: height * 0.4,
        }}
      >
        <MapPin x={width * 0.25} y={height * 0.08} delay={0} />
        <MapPin x={width * 0.52} y={height * 0.05} delay={150} />
        <MapPin x={width * 0.42} y={height * 0.15} delay={300} />
        <MapPin x={width * 0.68} y={height * 0.12} delay={450} />
        <MapPin x={width * 0.35} y={height * 0.22} delay={600} />
        <MapPin x={width * 0.58} y={height * 0.26} delay={750} />
        <MapPin x={width * 0.72} y={height * 0.19} delay={900} />
        <MapPin x={width * 0.38} y={height * 0.32} delay={1050} />
      </View>

      {/* "14 active nearby" floating badge */}
      <View
        style={{
          position: "absolute",
          top: height * 0.48,
          right: spacing.xl,
        }}
      >
        <View
          style={{
            backgroundColor: colors.yellow,
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#000",
              letterSpacing: 0.2,
            }}
          >
            14 active nearby
          </Text>
        </View>
      </View>

      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.base,
          paddingBottom: insets.bottom + spacing["2xl"],
          justifyContent: "space-between",
        }}
      >
        {/* Headline at top - moved higher and made smaller to fit on one line */}
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={{
              fontSize: 31,
              fontWeight: "800",
              color: "#FFFFFF",
              marginBottom: spacing.sm,
              letterSpacing: -0.5,
              lineHeight: 37,
            }}
          >
            See what's happening near you.
          </Text>

          <Text
            style={{
              fontSize: 17,
              fontWeight: "500",
              color: "rgba(255, 255, 255, 0.80)",
              lineHeight: 23,
            }}
          >
            {slide.subtext}
          </Text>
        </View>

        {/* CTA at bottom */}
        <CTAButton onPress={onNext} label="Next" />
      </View>
    </View>
  );
}

// SLIDE 3 - SHARED INTEREST RANGE (2x2 quad grid)
function Slide3Interests({ slide, insets, onNext }) {
  const activities = [
    {
      label: "Pickleball",
      emoji: "🏓",
      image:
        "https://ucarecdn.com/894f03d7-b368-45fd-82b0-54a4002eeab8/-/format/auto/",
    },
    {
      label: "Sushi",
      emoji: "🍣",
      image:
        "https://ucarecdn.com/4f4dafda-8dda-49a0-b964-582a1e02b757/-/format/auto/",
    },
    {
      label: "Game Night",
      emoji: "🎲",
      image:
        "https://ucarecdn.com/03ff12e1-4406-4938-837d-8c1418e8e9cc/-/format/auto/",
    },
    {
      label: "Sports Bar",
      emoji: "🍺",
      image:
        "https://ucarecdn.com/5cfd2186-792a-4cdb-ad56-a8b3feec598e/-/format/auto/",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.base,
          paddingBottom: insets.bottom + spacing["2xl"],
          justifyContent: "space-between",
        }}
      >
        {/* Top headline - moved higher */}
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={{
              fontSize: 38,
              fontWeight: "800",
              color: colors.text,
              marginBottom: spacing.sm,
              letterSpacing: -0.5,
              textAlign: "center",
            }}
          >
            {slide.headline}
          </Text>

          <Text
            style={{
              fontSize: 17,
              fontWeight: "500",
              color: colors.subtext,
              lineHeight: 23,
              textAlign: "center",
              paddingHorizontal: spacing.base,
            }}
          >
            {slide.subtext}
          </Text>
        </View>

        {/* 2x2 quad grid with clean minimal labels */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.base,
            marginBottom: spacing.base,
          }}
        >
          {activities.map((activity, index) => (
            <View
              key={index}
              style={{
                width: (width - spacing.xl * 2 - spacing.base) / 2,
                height: 180,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: "#1a1c20",
              }}
            >
              {/* Activity image - full visibility, no gradient overlay */}
              <Image
                source={{ uri: activity.image }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                }}
                contentFit="cover"
                transition={100}
              />

              {/* Clean minimal pill label at bottom-left */}
              <View
                style={{
                  position: "absolute",
                  bottom: spacing.sm,
                  left: spacing.sm,
                }}
              >
                <View
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.7)",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{activity.emoji}</Text>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    {activity.label}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <CTAButton onPress={onNext} label="Next" />
      </View>
    </View>
  );
}

// SLIDE 4 - ACTION (Create Plan UI - List Style)
function Slide4Action({ slide, insets, onNext }) {
  const ChevronRight = () => (
    <Text style={{ fontSize: 20, color: colors.subtext }}>›</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing["2xl"],
          paddingBottom: insets.bottom + spacing["2xl"],
          justifyContent: "space-between",
        }}
      >
        {/* Top headline */}
        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={{
              fontSize: 40,
              fontWeight: "800",
              color: colors.text,
              marginBottom: spacing.sm,
              letterSpacing: -0.5,
            }}
          >
            {slide.headline}
          </Text>

          <Text
            style={{
              fontSize: 17,
              fontWeight: "500",
              color: colors.subtext,
              lineHeight: 23,
            }}
          >
            {slide.subtext}
          </Text>
        </View>

        {/* Create Plan UI mockup - List style */}
        <View style={{ gap: spacing.base, marginBottom: spacing["2xl"] }}>
          {/* Header with "..." menu */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: spacing.sm,
              marginBottom: spacing.xs,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              Create Plan
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: colors.subtext,
                lineHeight: 28,
              }}
            >
              ⋯
            </Text>
          </View>

          {/* List container */}
          <View
            style={{
              backgroundColor: "#1a1c20",
              borderRadius: radius.lg,
              overflow: "hidden",
            }}
          >
            {/* Activity Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.base,
                paddingHorizontal: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  flex: 1,
                }}
              >
                <Text style={{ fontSize: 22 }}>🏓</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: colors.subtext,
                      marginBottom: 2,
                    }}
                  >
                    Activity
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: colors.text,
                    }}
                  >
                    Pickleball
                  </Text>
                </View>
              </View>
              <ChevronRight />
            </View>

            {/* Location & Time Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.base,
                paddingHorizontal: spacing.lg,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  flex: 1,
                }}
              >
                <Text style={{ fontSize: 22 }}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: colors.text,
                      marginBottom: 2,
                    }}
                  >
                    Smith Park
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: colors.subtext,
                    }}
                  >
                    Today, 5:00 PM
                  </Text>
                </View>
              </View>
              <ChevronRight />
            </View>

            {/* Invite People Row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.base,
                paddingHorizontal: spacing.lg,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  flex: 1,
                }}
              >
                <Text style={{ fontSize: 22 }}>👥</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: colors.subtext,
                      marginBottom: 2,
                    }}
                  >
                    Invite People
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.xs,
                    }}
                  >
                    {/* Overlapping profile photos */}
                    <View
                      style={{ flexDirection: "row", marginRight: spacing.xs }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#FF6B6B",
                          borderWidth: 2,
                          borderColor: "#1a1c20",
                          zIndex: 2,
                        }}
                      />
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#4ECDC4",
                          borderWidth: 2,
                          borderColor: "#1a1c20",
                          marginLeft: -8,
                          zIndex: 1,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "500",
                        color: colors.text,
                      }}
                    >
                      2 Invited
                    </Text>
                  </View>
                </View>
              </View>
              <ChevronRight />
            </View>
          </View>
        </View>

        {/* Get Started CTA */}
        <CTAButton onPress={onNext} label="Get Started" />
      </View>
    </View>
  );
}

// Yellow CTA button component
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
        paddingHorizontal: spacing["2xl"],
        borderRadius: radius.md,
        alignItems: "center",
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: "#000",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Map pin with slow pulse animation (2-3 seconds)
function MapPin({ x, y, delay = 0 }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Slow pulse (2.5 seconds)
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
        ).start();

        // Glow pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.75,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.5,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      });
    }, delay);
  }, [delay, fadeAnim, pulseAnim, glowAnim]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - 18,
        top: y - 36,
        opacity: fadeAnim,
        transform: [{ scale: pulseAnim }],
      }}
    >
      {/* Reduced glow radius (from 48 to 44) */}
      <Animated.View
        style={{
          position: "absolute",
          left: -4,
          top: -4,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.yellow,
          opacity: glowAnim,
        }}
      />

      {/* Pin body - increased center brightness */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#FFE066",
          borderWidth: 3,
          borderColor: colors.yellow,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Brighter center dot */}
        <View
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: "#FFF",
          }}
        />
      </View>
    </Animated.View>
  );
}
