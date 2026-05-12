import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, Text, Platform, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAuth } from "../../lib/auth-context";
import GlassSurface from "../../components/GlassSurface";

const FLOATING_RADIUS = 28;
const BAR_HEIGHT = 60;
const INDICATOR_INSET = 6;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [innerWidth, setInnerWidth] = useState(0);

  const visibleRoutes = state.routes.filter(
    (r) => (descriptors[r.key].options as any).href !== null
  );
  const focusedKey = state.routes[state.index]?.key;
  const focusedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((r) => r.key === focusedKey)
  );
  const tabWidth =
    visibleRoutes.length > 0 ? innerWidth / visibleRoutes.length : 0;

  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.value = withSpring(focusedVisibleIndex * tabWidth, {
      damping: 18,
      stiffness: 180,
      mass: 0.9,
    });
  }, [focusedVisibleIndex, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidth,
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barWrap, { bottom: Math.max(insets.bottom - 14, 4) }]}
    >
      <GlassSurface
        glassStyle="regular"
        isInteractive
        style={styles.bar}
        fallbackStyle={styles.barFallback}
      >
        <View
          style={styles.tabsRow}
          onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}
        >
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, indicatorStyle]}
            />
          )}
          {visibleRoutes.map((route) => {
            const realIndex = state.routes.findIndex((r) => r.key === route.key);
            const { options } = descriptors[route.key];
            const isFocused = state.index === realIndex;
            const color = isFocused ? "#7FD9A8" : "#8A8F98";

            const labelOption =
              options.tabBarLabel ?? options.title ?? route.name;
            const labelText =
              typeof labelOption === "string" ? labelOption : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            const icon = options.tabBarIcon?.({
              focused: isFocused,
              color,
              size: 22,
            });

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                style={styles.tab}
              >
                {icon}
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {labelText}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

export default function TabLayout() {
  const { player } = useAuth();
  const useCustomBar = Platform.OS !== "web";

  return (
    <Tabs
      tabBar={useCustomBar ? (props) => <CustomTabBar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarStyle: useCustomBar
          ? undefined
          : {
              backgroundColor: "#1E1E1E",
              borderTopColor: "rgba(255,255,255,0.06)",
              borderTopWidth: StyleSheet.hairlineWidth,
              height: 56,
              paddingBottom: 4,
              paddingTop: 4,
            },
        tabBarActiveTintColor: "#7FD9A8",
        tabBarInactiveTintColor: "#8A8F98",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pool",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 22 }}>{"\u2630"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 22 }}>{"\uD83C\uDFC6"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 22 }}>{"\uD83D\uDC64"}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 22 }}>{"\u2699"}</Text>
          ),
          href: player?.is_admin ? undefined : null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: "absolute",
    left: 24,
    right: 24,
    alignItems: "stretch",
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: FLOATING_RADIUS,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  barFallback: {
    backgroundColor: "rgba(34, 38, 46, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: FLOATING_RADIUS,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
  },
  indicator: {
    position: "absolute",
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: 0,
    borderRadius: FLOATING_RADIUS - INDICATOR_INSET,
    backgroundColor: "rgba(127, 217, 168, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(127, 217, 168, 0.32)",
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
});
