import { View, StyleSheet, Platform } from "react-native";
import type { ViewProps, ViewStyle, StyleProp } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { GlassStyle } from "expo-glass-effect";

const liquidGlass =
  Platform.OS === "ios" && isLiquidGlassAvailable();

interface GlassSurfaceProps extends ViewProps {
  glassStyle?: GlassStyle;
  tintColor?: string;
  fallbackStyle?: StyleProp<ViewStyle>;
  isInteractive?: boolean;
}

export default function GlassSurface({
  glassStyle = "regular",
  tintColor,
  fallbackStyle,
  isInteractive,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        colorScheme="dark"
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.fallback, fallbackStyle, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(40, 44, 50, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});

export { liquidGlass };
