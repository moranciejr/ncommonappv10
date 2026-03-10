import { Tabs } from "expo-router";
import { MapPin, Navigation, Star, User, Users } from "lucide-react-native";
import { theme } from "@/utils/theme"; // Use dark theme
import { useQuery } from "@tanstack/react-query";
import authedFetch from "@/utils/authedFetch";
import { readResponseBody, getErrorMessageFromBody } from "@/utils/http";

export default function TabLayout() {
  const notificationsSummaryQuery = useQuery({
    queryKey: ["notificationsSummary"],
    queryFn: async () => {
      try {
        const response = await authedFetch("/api/notifications?summary=1");
        const data = await readResponseBody(response);
        if (!response.ok) {
          const msg = getErrorMessageFromBody(data, response);
          console.error(
            `When fetching /api/notifications?summary=1, the response was [${response.status}] ${msg}`,
          );
          return { ok: false, unreadCount: 0 };
        }
        return data;
      } catch (err) {
        console.error("Failed to fetch notifications summary", err);
        return { ok: false, unreadCount: 0 };
      }
    },
    staleTime: 15000,
    refetchOnReconnect: true,
    refetchOnMount: true,
    // Keep the badge reasonably fresh without being spammy.
    refetchInterval: 30000,
  });

  const unreadCount = notificationsSummaryQuery.data?.unreadCount || 0;
  const badgeValue = unreadCount
    ? unreadCount > 99
      ? "99+"
      : unreadCount
    : undefined;

  return (
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        // Ticket 3 — Bottom tab bar redesign (dark + translucent + readable)
        tabBarStyle: {
          backgroundColor: theme.colors.surface, // dark translucent panel
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          paddingTop: 8,
          paddingBottom: 12,
          paddingHorizontal: 8,
          shadowColor: theme.colors.pinShadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -10 },
          elevation: 20,
        },
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.mutedText,
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 4,
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.colors.primary,
          color: theme.colors.text,
          fontSize: 10,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 6,
          alignSelf: "center",
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <MapPin color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="ncommon"
        options={{
          title: "nCommon",
          tabBarIcon: ({ color }) => <Users color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="nearest"
        options={{
          title: "Nearest",
          tabBarIcon: ({ color }) => <Navigation color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="stars"
        options={{
          title: "Stars",
          tabBarIcon: ({ color }) => <Star color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
          tabBarBadge: badgeValue,
        }}
      />
    </Tabs>
  );
}
