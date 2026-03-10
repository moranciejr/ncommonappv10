// ============================================================================
// DESIGN SYSTEM
// Unified typography, spacing, colors, and component tokens for the entire app
// ============================================================================

// SPACING SCALE
// Use these for padding, margin, gaps
// Based on 4px grid: xs(4) → sm(8) → md(12) → base(16) → lg(24) → xl(32) → 2xl(48) → 3xl(64)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
  "4xl": 80,
};

// TYPOGRAPHY SCALE
// Sizes, weights, line heights
export const typography = {
  // Display / Hero (40-56px)
  display: {
    xl: { fontSize: 56, lineHeight: 64, fontWeight: "800" },
    lg: { fontSize: 48, lineHeight: 56, fontWeight: "800" },
    md: { fontSize: 40, lineHeight: 48, fontWeight: "800" },
  },

  // Headings (20-32px)
  heading: {
    xl: { fontSize: 32, lineHeight: 40, fontWeight: "700" },
    lg: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
    md: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
    sm: { fontSize: 20, lineHeight: 28, fontWeight: "700" },
  },

  // Body text (14-18px)
  body: {
    lg: { fontSize: 18, lineHeight: 26, fontWeight: "500" },
    md: { fontSize: 16, lineHeight: 24, fontWeight: "500" },
    sm: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  },

  // Labels / UI elements (12-16px)
  label: {
    lg: { fontSize: 16, lineHeight: 20, fontWeight: "600" },
    md: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
    sm: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  },

  // Caption / helper text (10-12px)
  caption: {
    md: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
    sm: { fontSize: 10, lineHeight: 14, fontWeight: "500" },
  },
};

// FONT WEIGHTS (for custom combinations)
export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
};

// BORDER RADIUS
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  pill: 999,
};

// ============================================================================
// LIGHT THEME (Main app screens)
// ============================================================================
export const lightTheme = {
  colors: {
    // Backgrounds
    background: "#F7F5FF",
    card: "#FFFFFF",
    surface: "#FFFFFF",
    mutedBg: "#F2F4F7",

    // Text
    text: "#101828",
    subtext: "#667085",
    mutedText: "rgba(16, 24, 40, 0.6)",

    // Brand
    primary: "#2D114D",
    primaryText: "#FFFFFF",
    accent: "#12B76A",
    accentText: "#FFFFFF",
    yellow: "#FFD93D",

    // Borders & dividers
    border: "rgba(16, 24, 40, 0.10)",
    divider: "rgba(16, 24, 40, 0.06)",

    // States
    dangerBg: "#FDECEC",
    dangerText: "#B00020",
    minorBg: "rgba(255, 213, 79, 0.28)",
    minorText: "#7A4B00",

    // Chips / pills
    chipBg: "rgba(45,17,77,0.06)",
    chipText: "#2D114D",
    chipActiveBg: "#FFD93D",
    chipActiveText: "#000000",
  },

  spacing,
  typography,
  fontWeights,
  radius,

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    sm: {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
};

// ============================================================================
// DARK THEME (Map, intro, dark mode screens)
// ============================================================================
export const darkTheme = {
  colors: {
    // Backgrounds
    background: "#0B0D12",
    surface: "#121622",
    surfaceElevated: "#1A1F2E",
    card: "#1A1F2E",
    mutedBg: "rgba(255, 255, 255, 0.08)",

    // Text
    text: "#F2F4F8",
    subtext: "rgba(242, 244, 248, 0.7)",
    mutedText: "rgba(242, 244, 248, 0.5)",

    // Brand
    primary: "#8B5CF6",
    primaryMuted: "rgba(139, 92, 246, 0.85)",
    purple: "#2D114D",
    yellow: "#FFD93D",

    // Controls
    controlBg: "rgba(18, 22, 34, 0.72)",
    controlBorder: "rgba(255, 255, 255, 0.10)",

    // Borders & dividers
    border: "rgba(255, 255, 255, 0.12)",
    divider: "rgba(255, 255, 255, 0.08)",

    // Map pins - category ring colors
    pin: {
      sports: "#39D98A",
      fitness: "#39D98A",
      music: "#2DD4BF",
      food: "#FB923C",
      drinks: "#FB923C",
      bar: "#FB923C",
      restaurant: "#FB923C",
      gaming: "#60A5FA",
      games: "#60A5FA",
      reading: "#A78BFA",
      books: "#A78BFA",
      outdoor: "#34D399",
      hiking: "#34D399",
      nature: "#34D399",
      social: "#F472B6",
      people: "#F472B6",
      other: "#8B5CF6",
    },

    pinInner: "#0B0D12",
    pinStroke: "rgba(255, 255, 255, 0.16)",
    pinSelectedStroke: "rgba(255, 255, 255, 0.9)",
    pinShadow: "rgba(0, 0, 0, 0.35)",

    // Cluster
    clusterBg: "rgba(18, 22, 34, 0.92)",
    clusterBorder: "rgba(255, 255, 255, 0.14)",
    clusterShadow: "rgba(0, 0, 0, 0.35)",

    // Overlays
    overlay: "rgba(11, 13, 18, 0.85)",
    scrim: "rgba(0, 0, 0, 0.40)",

    // Splash rings
    ring: "rgba(139, 92, 246, 0.35)",
    ring2: "rgba(45, 212, 191, 0.20)",

    // Chips / pills
    chipBg: "rgba(255, 255, 255, 0.15)",
    chipText: "#FFFFFF",
    chipActiveBg: "#FFD93D",
    chipActiveText: "#000000",

    // Semantic - danger
    dangerBg: "rgba(176, 0, 32, 0.15)",
    dangerText: "#FF6B6B",

    // Semantic - minor user indicator
    minorBg: "rgba(255, 213, 79, 0.18)",
    minorText: "#FFD93D",

    // Brand text on primary bg
    primaryText: "#FFFFFF",

    // Accent (success green)
    accent: "#34D399",
    accentText: "#000000",

    // Surface tint (subtle purple wash for elevated cards)
    surfaceTint: "rgba(139, 92, 246, 0.08)",
  },

  spacing,
  typography,
  fontWeights,
  radius,

  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    sm: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
};

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================
export const colors = darkTheme.colors;
export const radii = {
  card: lightTheme.radius.xl,
  pill: lightTheme.radius.pill,
  button: lightTheme.radius.lg,
};
export const shadow = darkTheme.shadow;

// Default theme export
export const theme = darkTheme;
