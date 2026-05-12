import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function registerForPushNotifications(
  playerId: string
): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push notifications require a physical device");
    return null;
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Push notification permission not granted");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase
      .from("players")
      .update({ expo_push_token: token })
      .eq("id", playerId);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return token;
  } catch (err: any) {
    console.warn("Push notifications unavailable:", err?.message ?? err);
    return null;
  }
}

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const receivedSubscription =
    Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification);
    });

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification tapped:", response);
    });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
