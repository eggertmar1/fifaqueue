import { View, Text, StyleSheet } from "react-native";

interface StarRatingProps {
  rating: number;
}

export default function StarRating({ rating }: StarRatingProps) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Text
        key={i}
        style={[styles.star, i <= rating ? styles.active : styles.inactive]}
      >
        {i <= rating ? "\u2605" : "\u2606"}
      </Text>
    );
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
});
