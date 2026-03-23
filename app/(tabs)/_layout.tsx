import { Tabs } from "expo-router";
import { View, Text, Platform } from "react-native";
import { useAuth } from "../../lib/auth-context";

export default function TabLayout() {
  const { player } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1E1E1E",
          borderTopColor: "#333333",
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#00D26A",
        tabBarInactiveTintColor: "#666666",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pool",
          tabBarIcon: ({ color, focused }) => (
            focused || Platform.OS !== "web" ? <Text style={{ color, fontSize: 22 }}>{"\u2630"}</Text> : <View />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, focused }) => (
            focused || Platform.OS !== "web" ? <Text style={{ color, fontSize: 22 }}>{"\uD83C\uDFC6"}</Text> : <View />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            focused || Platform.OS !== "web" ? <Text style={{ color, fontSize: 22 }}>{"\uD83D\uDC64"}</Text> : <View />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, focused }) => (
            focused || Platform.OS !== "web" ? <Text style={{ color, fontSize: 22 }}>{"\u2699"}</Text> : <View />
          ),
          href: player?.is_admin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
