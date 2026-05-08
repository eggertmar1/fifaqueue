import { View, Text, StyleSheet } from "react-native";

interface StarRatingProps {
  rating: number;
}

export default function StarRating({ rating }: StarRatingProps) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(
        <Text key={i} style={[styles.star, styles.active]}>
          {"\u2605"}
        </Text>
      );
    } else if (rating >= i - 0.5) {
      stars.push(
        <View key={i} style={styles.halfWrap}>
          <Text style={[styles.star, styles.inactive]}>{"\u2606"}</Text>
          <View style={styles.halfClip} pointerEvents="none">
            <Text style={[styles.star, styles.active]}>{"\u2605"}</Text>
          </View>
        </View>
      );
    } else {
      stars.push(
        <Text key={i} style={[styles.star, styles.inactive]}>
          {"\u2606"}
        </Text>
      );
    }
  }

  return <View style={styles.container}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 2,
  },
  star: {
    fontSize: 18,
  },
  active: {
    color: "#FFB800",
  },
  inactive: {
    color: "#4B5563",
  },
  halfWrap: {
    position: "relative",
  },
  halfClip: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "50%",
    overflow: "hidden",
  },
});
