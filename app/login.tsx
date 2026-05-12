import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { signIn, loading } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.brandingContainer}>
          <Text style={styles.fifaText}>FIFA</Text>
          <Text style={styles.queueText}>QUEUE</Text>
          <Text style={styles.tagline}>Office FIFA. Ranked.</Text>
        </View>

        <View style={styles.buttonContainer}>
          <Pressable
            onPress={signIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              loading && styles.googleButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#333" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Sign in with your company Google account to join the queue.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#171B22",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  brandingContainer: {
    alignItems: "center",
    marginBottom: 64,
  },
  fifaText: {
    color: "#7FD9A8",
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: 4,
  },
  queueText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: 6,
    marginTop: -4,
  },
  tagline: {
    color: "#666666",
    fontSize: 14,
    marginTop: 8,
  },
  buttonContainer: {
    width: "100%",
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  googleButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  googleIcon: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  googleButtonText: {
    color: "#333333",
    fontSize: 17,
    fontWeight: "600",
  },
  footerText: {
    color: "#555555",
    fontSize: 12,
    textAlign: "center",
    marginTop: 32,
    lineHeight: 18,
  },
});
