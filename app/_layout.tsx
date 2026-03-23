import "../global.css";
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth-context";
import {
  registerForPushNotifications,
  setupNotificationHandler,
} from "../lib/push-notifications";

function RootLayoutNav() {
  const { session, player, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    return setupNotificationHandler();
  }, []);

  useEffect(() => {
    if (player?.id) {
      registerForPushNotifications(player.id);
    }
  }, [player?.id]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(tabs)";

    if (!session && inAuthGroup) {
      router.replace("/login");
    } else if (session && !inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111" }}>
        <ActivityIndicator size="large" color="#00D26A" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
