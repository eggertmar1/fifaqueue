import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import { getCurrentSeason } from "../../lib/queue";
import type { Player, Season, GameResult, Game } from "../../lib/types";

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
  );
}

export default function AdminScreen() {
  const { player } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [todayResults, setTodayResults] = useState<
    (GameResult & { game?: Game })[]
  >([]);
  const [newEmail, setNewEmail] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [editTeam1, setEditTeam1] = useState(0);
  const [editTeam2, setEditTeam2] = useState(0);
  const [poolPlayerIds, setPoolPlayerIds] = useState<Set<string>>(new Set());

  const today = new Date().toISOString().split("T")[0];

  async function refresh() {
    const [{ data: p }, { data: s }, { data: todayGames }, { data: poolEntries }] = await Promise.all([
      supabase.from("players").select("*").order("name"),
      supabase.from("seasons").select("*").order("started_at", { ascending: false }),
      supabase
        .from("games")
        .select("*, game_results(*)")
        .eq("date", today)
        .eq("status", "completed"),
      supabase
        .from("queue_entries")
        .select("player_id")
        .eq("date", today)
        .in("status", ["registered", "playing"]),
    ]);

    setPlayers((p ?? []) as Player[]);
    setSeasons((s ?? []) as Season[]);
    setPoolPlayerIds(new Set((poolEntries ?? []).map((e: any) => e.player_id)));

    const results: (GameResult & { game?: Game })[] = [];
    for (const game of todayGames ?? []) {
      const gr = (game as any).game_results;
      if (gr && gr.length > 0) {
        results.push({ ...gr[0], game });
      }
    }
    setTodayResults(results);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!player?.is_admin) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.accessDeniedText}>Admin access required</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator color="#00D26A" size="large" />
      </SafeAreaView>
    );
  }

  const handleAddPlayer = async () => {
    const email = newEmail.trim();
    if (!email) return;
    await supabase.from("players").insert({
      google_id: email,
      name: email.split("@")[0],
    });
    setNewEmail("");
    refresh();
  };

  const handleRemovePlayer = async (id: string) => {
    Alert.alert("Remove Player", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await supabase.from("players").delete().eq("id", id);
          refresh();
        },
      },
    ]);
  };

  const handleResetQueue = async () => {
    Alert.alert("Reset Pool", "This will clear today's pool.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          await supabase
            .from("queue_entries")
            .delete()
            .eq("date", today);
          refresh();
        },
      },
    ]);
  };

  const handleDeleteResult = async (gameId: string) => {
    Alert.alert("Delete Result", "This will reverse ELO changes.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          // Reverse ELO: get elo_history for this game and revert
          const { data: history } = await supabase
            .from("elo_history")
            .select("*")
            .eq("game_id", gameId);

          for (const h of history ?? []) {
            await supabase
              .from("players")
              .update({ elo: h.elo_before })
              .eq("id", h.player_id);
          }

          await supabase.from("elo_history").delete().eq("game_id", gameId);
          await supabase.from("game_results").delete().eq("game_id", gameId);
          await supabase
            .from("game_players")
            .delete()
            .eq("game_id", gameId);
          await supabase.from("games").delete().eq("id", gameId);
          refresh();
        },
      },
    ]);
  };

  const handleStartNewSeason = async () => {
    const name = newSeasonName.trim();
    if (!name) return;

    // End current season
    const currentSeason = await getCurrentSeason();
    if (currentSeason) {
      await supabase
        .from("seasons")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", currentSeason.id);
    }

    // Create new season
    await supabase.from("seasons").insert({ name });

    // Reset all player ELOs to 1000
    await supabase.from("players").update({ elo: 1000 }).neq("id", "");

    setNewSeasonName("");
    refresh();
  };

  const handleTogglePool = async (playerId: string) => {
    const currentSeason = seasons.find((s) => !s.ended_at);
    if (!currentSeason) return;

    if (poolPlayerIds.has(playerId)) {
      // Remove from pool
      await supabase
        .from("queue_entries")
        .delete()
        .eq("player_id", playerId)
        .eq("date", today)
        .eq("status", "registered");
    } else {
      // Add to pool
      await supabase.from("queue_entries").insert({
        player_id: playerId,
        season_id: currentSeason.id,
        date: today,
        position: 0,
        status: "registered",
        games_today: 0,
      });
    }
    refresh();
  };

  const currentSeason = seasons.find((s) => !s.ended_at);
  const queueOverride = currentSeason?.queue_open_override;

  const handleToggleQueue = async (override: boolean | null) => {
    if (!currentSeason) return;
    await supabase
      .from("seasons")
      .update({ queue_open_override: override })
      .eq("id", currentSeason.id);
    refresh();
  };

  const handleOverrideResult = async (gameId: string) => {
    if (editTeam1 === editTeam2) {
      Alert.alert("Invalid", "Scores cannot be equal.");
      return;
    }
    // Delete old result and re-submit via RPC (reverses old ELO, applies new)
    // First reverse ELO from old result
    const { data: history } = await supabase
      .from("elo_history")
      .select("*")
      .eq("game_id", gameId);

    for (const h of history ?? []) {
      await supabase
        .from("players")
        .update({ elo: h.elo_before })
        .eq("id", h.player_id);
    }

    // Clean up old result data
    await supabase.from("elo_history").delete().eq("game_id", gameId);
    await supabase.from("game_results").delete().eq("game_id", gameId);

    // Reset game_players elo_after
    await supabase
      .from("game_players")
      .update({ elo_after: null })
      .eq("game_id", gameId);

    // Set game back to active so submit_result can process it
    await supabase
      .from("games")
      .update({ status: "active", ended_at: null })
      .eq("id", gameId);

    // Re-submit with new scores
    const { error } = await supabase.rpc("submit_result", {
      p_game_id: gameId,
      p_team1_goals: editTeam1,
      p_team2_goals: editTeam2,
      p_submitted_by: player.id,
    });

    if (error) {
      Alert.alert("Error", error.message);
    }

    setEditingResult(null);
    refresh();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <Text style={styles.title}>Admin</Text>

        {/* Players Section */}
        <SectionHeader title="Players" />
        <View style={styles.inputRow}>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="Add player by email"
            placeholderTextColor="#666"
            style={styles.textInput}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Pressable
            onPress={handleAddPlayer}
            style={styles.primaryButton}
          >
            <Text style={styles.buttonText}>Add</Text>
          </Pressable>
        </View>
        {players.map((p) => {
          const avatarUri =
            p.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=2A2A2A&color=fff`;
          return (
            <View
              key={p.id}
              style={styles.playerRow}
            >
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
              />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerMeta}>
                  ELO: {p.elo} {p.is_admin ? " | Admin" : ""}
                </Text>
              </View>
              {p.id !== player.id && (
                <Pressable onPress={() => handleRemovePlayer(p.id)}>
                  <Text style={styles.removeText}>
                    Remove
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* Pool Settings */}
        <SectionHeader title="Pool Settings" />
        <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>
          Status: {queueOverride === true ? "Forced Open" : queueOverride === false ? "Forced Closed" : "Auto (11:00 schedule)"}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Pressable
            onPress={() => handleToggleQueue(true)}
            style={[styles.toggleButton, queueOverride === true && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleButtonText, queueOverride === true && styles.toggleButtonTextActive]}>Force Open</Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleQueue(false)}
            style={[styles.toggleButton, queueOverride === false && styles.toggleButtonClosed]}
          >
            <Text style={[styles.toggleButtonText, queueOverride === false && styles.toggleButtonTextActive]}>Force Close</Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleQueue(null)}
            style={[styles.toggleButton, queueOverride === null && styles.toggleButtonAuto]}
          >
            <Text style={[styles.toggleButtonText, queueOverride === null && styles.toggleButtonTextActive]}>Auto</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={handleResetQueue}
          style={styles.dangerButton}
        >
          <Text style={styles.dangerButtonText}>Reset Today's Pool</Text>
        </Pressable>

        {/* Pool Management */}
        <SectionHeader title="Today's Pool" />
        <Text style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 8 }}>
          Tap to add/remove players from today's pool ({poolPlayerIds.size} registered)
        </Text>
        {players.map((p) => {
          const isInPool = poolPlayerIds.has(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => handleTogglePool(p.id)}
              style={[styles.poolRow, isInPool && styles.poolRowActive]}
            >
              <View style={styles.flex1}>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={styles.playerMeta}>ELO: {p.elo}</Text>
              </View>
              <Text style={isInPool ? styles.poolStatusIn : styles.poolStatusOut}>
                {isInPool ? "In Pool" : "Not in Pool"}
              </Text>
            </Pressable>
          );
        })}

        {/* Results Section */}
        <SectionHeader title="Today's Results" />
        {todayResults.length === 0 ? (
          <Text style={styles.emptyText}>
            No completed games today
          </Text>
        ) : (
          todayResults.map((r) => (
            <View key={r.id}>
              <View style={styles.resultRow}>
                <View style={styles.flex1}>
                  <Text style={styles.playerName}>
                    Team 1: {r.team1_goals} - Team 2: {r.team2_goals}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setEditingResult(r.game_id);
                    setEditTeam1(r.team1_goals);
                    setEditTeam2(r.team2_goals);
                  }}
                  style={{ marginRight: 12 }}
                >
                  <Text style={{ color: "#FFB800", fontSize: 14, fontWeight: "600" }}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteResult(r.game_id)}>
                  <Text style={styles.removeText}>Delete</Text>
                </Pressable>
              </View>
              {editingResult === r.game_id && (
                <View style={styles.editRow}>
                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginRight: 8 }}>T1:</Text>
                  <TextInput
                    value={String(editTeam1)}
                    onChangeText={(t) => setEditTeam1(Number(t) || 0)}
                    keyboardType="number-pad"
                    style={styles.scoreInput}
                  />
                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginHorizontal: 8 }}>T2:</Text>
                  <TextInput
                    value={String(editTeam2)}
                    onChangeText={(t) => setEditTeam2(Number(t) || 0)}
                    keyboardType="number-pad"
                    style={styles.scoreInput}
                  />
                  <Pressable
                    onPress={() => handleOverrideResult(r.game_id)}
                    style={styles.saveButton}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingResult(null)} style={{ marginLeft: 8 }}>
                    <Text style={{ color: "#6B7280", fontSize: 14 }}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}

        {/* Seasons Section */}
        <SectionHeader title="Seasons" />
        <View style={styles.inputRow}>
          <TextInput
            value={newSeasonName}
            onChangeText={setNewSeasonName}
            placeholder="New season name"
            placeholderTextColor="#666"
            style={styles.textInput}
          />
          <Pressable
            onPress={handleStartNewSeason}
            style={styles.primaryButton}
          >
            <Text style={styles.buttonText}>Start</Text>
          </Pressable>
        </View>
        {seasons.map((s) => (
          <View
            key={s.id}
            style={styles.seasonCard}
          >
            <Text style={styles.playerName}>{s.name}</Text>
            <Text style={styles.playerMeta}>
              Started: {new Date(s.started_at).toLocaleDateString()}
              {s.ended_at
                ? ` | Ended: ${new Date(s.ended_at).toLocaleDateString()}`
                : " | Active"}
            </Text>
          </View>
        ))}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  accessDeniedText: {
    color: "#6B7280",
    fontSize: 16,
  },
  scrollView: {
    paddingHorizontal: 24,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    paddingTop: 16,
  },
  sectionHeader: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 24,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333333",
  },
  primaryButton: {
    backgroundColor: "#00D26A",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#333333",
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    color: "#fff",
    fontWeight: "600",
  },
  playerMeta: {
    color: "#6B7280",
    fontSize: 12,
  },
  removeText: {
    color: "#F87171",
    fontSize: 14,
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "rgba(127, 29, 29, 0.5)",
    borderWidth: 1,
    borderColor: "#991B1B",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  dangerButtonText: {
    color: "#FCA5A5",
    fontWeight: "700",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
  },
  seasonCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333333",
  },
  toggleButtonActive: {
    backgroundColor: "rgba(0, 210, 106, 0.2)",
    borderColor: "#00D26A",
  },
  toggleButtonClosed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
  },
  toggleButtonAuto: {
    backgroundColor: "rgba(255, 184, 0, 0.2)",
    borderColor: "#FFB800",
  },
  toggleButtonText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleButtonTextActive: {
    color: "#fff",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    marginTop: -4,
  },
  scoreInput: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    width: 48,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#333333",
  },
  saveButton: {
    backgroundColor: "#00D26A",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
  },
  poolRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#333333",
  },
  poolRowActive: {
    backgroundColor: "rgba(0, 210, 106, 0.1)",
    borderColor: "#00D26A",
  },
  poolStatusIn: {
    color: "#00D26A",
    fontSize: 13,
    fontWeight: "600",
  },
  poolStatusOut: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 32,
  },
});
