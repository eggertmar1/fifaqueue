import { View, Text, Pressable, ActivityIndicator, StyleSheet, Button, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../lib/auth-context";
import {
  registerForPool,
  leavePool,
  startGame,
  submitResult,
  getActiveGame,
  getTodayPool,
  getCurrentSeason,
} from "../../lib/queue";
import { supabase } from "../../lib/supabase";
import type { QueueEntry, Game, GamePlayer, Season, Player } from "../../lib/types";
import QueueList from "../../components/QueueList";
import ActiveGame from "../../components/ActiveGame";
import SubmitResult from "../../components/SubmitResult";

function getReykjavikHour(): number {
  const now = new Date();
  const reykjavik = new Date(
    now.toLocaleString("en-US", { timeZone: "Atlantic/Reykjavik" })
  );
  return reykjavik.getHours();
}

function getTimeUntil11(): string {
  const now = new Date();
  const reykjavik = new Date(
    now.toLocaleString("en-US", { timeZone: "Atlantic/Reykjavik" })
  );
  const target = new Date(reykjavik);
  target.setHours(11, 0, 0, 0);
  if (reykjavik >= target) {
    target.setDate(target.getDate() + 1);
  }
  const diff = target.getTime() - reykjavik.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function QueueScreen() {
  const { player, signOut } = useAuth();
  const [season, setSeason] = useState<Season | null>(null);
  const [pool, setPool] = useState<QueueEntry[]>([]);
  const [activeGame, setActiveGame] = useState<
    (Game & { game_players: (GamePlayer & { player?: Player })[] }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(getTimeUntil11());
  const [queueOpen, setQueueOpen] = useState(getReykjavikHour() >= 11);

  const refreshData = useCallback(async () => {
    const s = await getCurrentSeason();
    setSeason(s);
    if (!s) {
      setLoading(false);
      return;
    }
    // Respect admin override: true = forced open, false = forced closed, null = schedule
    if (s.queue_open_override !== null) {
      setQueueOpen(s.queue_open_override);
    } else {
      setQueueOpen(getReykjavikHour() >= 11);
    }
    const [q, g] = await Promise.all([
      getTodayPool(s.id),
      getActiveGame(s.id),
    ]);
    setPool(q);
    setActiveGame(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (player) refreshData();
    else setLoading(false);
  }, [refreshData, player]);

  // Countdown timer — only controls queueOpen when no admin override
  useEffect(() => {
    const interval = setInterval(() => {
      const hour = getReykjavikHour();
      if (season?.queue_open_override === null || season?.queue_open_override === undefined) {
        setQueueOpen(hour >= 11);
      }
      if (hour < 11) {
        setCountdown(getTimeUntil11());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [season?.queue_open_override]);

  // Poll for updates every 5 seconds (reliable fallback for PWA)
  useEffect(() => {
    if (!season) return;
    const interval = setInterval(() => {
      refreshData();
    }, 5000);
    return () => clearInterval(interval);
  }, [season, refreshData]);

  // Refresh when app comes back to foreground (tab switch, PWA reopen)
  useEffect(() => {
    if (!player) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }
  }, [player, refreshData]);

  const myPoolEntry = pool.find((e) => e.player_id === player?.id);
  const isRegistered = !!myPoolEntry;
  const registeredCount = pool.filter((e) => e.status === "registered").length;
  const canStartGame = isRegistered && !activeGame && registeredCount >= 2;
  const isInActiveGame =
    activeGame?.game_players.some((gp) => gp.player_id === player?.id) ?? false;

  // Calculate max ELO for star ratings
  const maxElo = Math.max(
    ...pool.map((e) => e.player?.elo ?? 1000),
    ...(activeGame?.game_players.map((gp) => gp.elo_before) ?? []),
    1000
  );

  const handleRegister = async () => {
    if (!player || !season) return;
    setJoining(true);
    try {
      await registerForPool(player.id, season.id);
      await refreshData();
    } catch (e) {
      console.error("Failed to register for pool:", e);
    }
    setJoining(false);
  };

  const handleLeave = async () => {
    if (!player) return;
    try {
      await leavePool(player.id);
      await refreshData();
    } catch (e) {
      console.error("Failed to leave pool:", e);
    }
  };

  const handleStartGame = async () => {
    if (!season) return;
    setStarting(true);
    try {
      await startGame(season.id);
      await refreshData();
    } catch (e) {
      console.error("Failed to start game:", e);
    }
    setStarting(false);
  };

  const handleSubmitResult = async (team1Goals: number, team2Goals: number) => {
    if (!activeGame || !player) return;
    setSubmitting(true);
    try {
      await submitResult(activeGame.id, team1Goals, team2Goals, player.id);
      await refreshData();
    } catch (e) {
      console.error("Failed to submit result:", e);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <ActivityIndicator color="#00D26A" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!player) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={[s.mutedText, { marginBottom: 12 }]}>Signing in...</Text>
          <ActivityIndicator color="#00D26A" size="small" />
          <View style={{ marginTop: 30 }}>
            <Button
              title="Sign Out"
              color="#EF4444"
              onPress={() => {
                Alert.alert("Sign Out", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign Out", style: "destructive", onPress: () => signOut() },
                ]);
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Pool closed state
  if (!queueOpen) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Pool</Text>
        </View>
        <View style={s.center}>
          <Text style={s.mutedText}>Registration opens at</Text>
          <Text style={[s.whiteText, { fontSize: 36, fontWeight: "800", marginVertical: 4 }]}>11:00</Text>
          <Text style={[s.mutedText, { fontSize: 13, marginBottom: 24 }]}>Europe/Reykjavik</Text>
          <View style={s.card}>
            <Text style={[s.mutedText, { fontSize: 11, letterSpacing: 2, marginBottom: 8 }]}>OPENS IN</Text>
            <Text style={{ color: "#00D26A", fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{countdown}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Pool open state
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Pool</Text>
        {season && <Text style={[s.mutedText, { fontSize: 13 }]}>{season.name}</Text>}
      </View>

      {/* Active Game Section */}
      {activeGame && (
        <View style={{ marginBottom: 16 }}>
          <ActiveGame gamePlayers={activeGame.game_players} maxElo={maxElo} />
          {isInActiveGame && (
            <SubmitResult onSubmit={handleSubmitResult} submitting={submitting} />
          )}
        </View>
      )}

      {/* Pool Registration Status */}
      {!isInActiveGame && (
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          {!isRegistered ? (
            <Pressable
              onPress={handleRegister}
              disabled={joining}
              style={({ pressed }) => [s.primaryButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.primaryButtonText}>{joining ? "Registering..." : "Register"}</Text>
            </Pressable>
          ) : (
            <View style={[s.card, { alignItems: "center" }]}>
              <Text style={{ color: "#00D26A", fontSize: 16, fontWeight: "600" }}>You're registered</Text>
              <Pressable onPress={handleLeave} style={{ marginTop: 12 }}>
                <Text style={{ color: "#EF4444", fontSize: 14 }}>Unregister</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Start Game Button */}
      {canStartGame && (
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <Pressable
            onPress={handleStartGame}
            disabled={starting}
            style={({ pressed }) => [s.accentButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.accentButtonText}>
              {starting ? "Starting..." : "Randomize & Start"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Pool List */}
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          <Text style={[s.mutedText, { fontSize: 13, fontWeight: "600" }]}>
            Registered ({registeredCount})
          </Text>
        </View>
        <QueueList
          entries={pool.filter((e) => e.status === "registered")}
          currentPlayerId={player?.id}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  whiteText: { color: "#fff" },
  mutedText: { color: "#888", fontSize: 14 },
  card: { backgroundColor: "#2A2A2A", borderRadius: 16, padding: 20, width: "100%" },
  primaryButton: {
    backgroundColor: "#00D26A",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  accentButton: {
    backgroundColor: "#FFB800",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  accentButtonText: { color: "#121212", fontWeight: "700", fontSize: 16 },
});
