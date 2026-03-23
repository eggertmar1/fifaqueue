import { Image, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import { getTeamLogoUrl, getFallbackLogoUrl } from "../lib/fifa-teams";

interface FifaTeamBadgeProps {
  teamName: string;
  size?: number;
}

export default function FifaTeamBadge({
  teamName,
  size = 48,
}: FifaTeamBadgeProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fallback = getFallbackLogoUrl(teamName);

  useEffect(() => {
    let cancelled = false;
    getTeamLogoUrl(teamName).then((url) => {
      if (!cancelled) setLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [teamName]);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Image
        source={{ uri: logoUrl || fallback }}
        style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
