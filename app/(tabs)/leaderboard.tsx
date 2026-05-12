import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import type { Season, LeaderboardEntry } from "../../lib/types";
import LeaderboardTable from "../../components/LeaderboardTable";

async function fetchSeasons(): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .order("started_at", { ascending: false });
  return (data ?? []) as Season[];
}

async function fetchLeaderboard(seasonId: string): Promise<LeaderboardEntry[]> {
  // Get all players
  const { data: players } = await supabase.from("players").select("*");
  if (!players) return [];

  // Get all completed games for this season
  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("season_id", seasonId)
    .eq("status", "completed");
  if (!games || games.length === 0) {
    return players.map((p, i) => ({
      rank: i + 1,
      player: p,
      elo: p.elo,
      wins: 0,
      losses: 0,
      winPct: 0,
      streak: "-",
      avgGoals: 0,
    }));
  }

  const gameIds = games.map((g) => g.id);

  // Get all game_players for these games
  const { data: gamePlayers } = await supabase
    .from("game_players")
    .select("*")
    .in("game_id", gameIds);

  // Get all game_results
  const { data: gameResults } = await supabase
    .from("game_results")
    .select("*")
    .in("game_id", gameIds);

  if (!gamePlayers || !gameResults) return [];

  const resultMap = new Map(gameResults.map((r) => [r.game_id, r]));

  // Build per-player stats
  const statsMap = new Map<
    string,
    {
      wins: number;
      losses: number;
      totalGoals: number;
      games: number;
      results: boolean[];
    }
  >();

  for (const gp of gamePlayers) {
    const result = resultMap.get(gp.game_id);
    if (!result) continue;

    const winTeam = result.team1_goals > result.team2_goals ? 1 : 2;
    const didWin = gp.team === winTeam;
    const teamGoals =
      gp.team === 1 ? result.team1_goals : result.team2_goals;

    const existing = statsMap.get(gp.player_id) || {
      wins: 0,
      losses: 0,
      totalGoals: 0,
      games: 0,
      results: [],
    };
    existing.games++;
    existing.totalGoals += teamGoals;
    existing.results.push(didWin);
    if (didWin) {
      existing.wins++;
    } else {
      existing.losses++;
    }
    statsMap.set(gp.player_id, existing);
  }

  const entries: LeaderboardEntry[] = players.map((p) => {
    const stats = statsMap.get(p.id);
    if (!stats || stats.games === 0) {
      return {
        rank: 0,
        player: p,
        elo: p.elo,
        wins: 0,
        losses: 0,
        winPct: 0,
        streak: "-",
        avgGoals: 0,
      };
    }

    // Calculate streak from most recent results
    let streak = "";
    const results = stats.results;
    if (results.length > 0) {
      const lastResult = results[results.length - 1];
      let count = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === lastResult) {
          count++;
        } else {
          break;
        }
      }
      streak = `${lastResult ? "W" : "L"}${count}`;
    }

    return {
      rank: 0,
      player: p,
      elo: p.elo,
      wins: stats.wins,
      losses: stats.losses,
      winPct: Math.round((stats.wins / stats.games) * 100),
      streak,
      avgGoals: stats.totalGoals / stats.games,
    };
  });

  // Sort by ELO descending and assign ranks
  entries.sort((a, b) => b.elo - a.elo);
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}

export default function LeaderboardScreen() {
  const { player } = useAuth();
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeasons().then((s) => {
      setSeasons(s);
      if (s.length > 0) {
        setSelectedSeason(s[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedSeason) return;
    setLoading(true);
    fetchLeaderboard(selectedSeason.id).then((e) => {
      setEntries(e);
      setLoading(false);
    });
  }, [selectedSeason]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        {/* Season selector */}
        {seasons.length > 1 && (
          <View style={styles.seasonRow}>
            {seasons.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedSeason(s)}
                style={[
                  styles.seasonPill,
                  selectedSeason?.id === s.id
                    ? styles.seasonPillActive
                    : styles.seasonPillInactive,
                ]}
              >
                <Text
                  style={[
                    styles.seasonText,
                    selectedSeason?.id === s.id
                      ? styles.seasonTextActive
                      : styles.seasonTextInactive,
                  ]}
                >
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {selectedSeason && seasons.length <= 1 && (
          <Text style={styles.singleSeasonName}>{selectedSeason.name}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#7FD9A8" size="large" />
        </View>
      ) : (
        <LeaderboardTable
          entries={entries}
          currentPlayerId={player?.id}
          onPlayerPress={(playerId) => router.push(`/profile?playerId=${playerId}`)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#171B22",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: "#E8E8E8",
    fontSize: 24,
    fontWeight: "700",
  },
  seasonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  seasonPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  seasonPillActive: {
    backgroundColor: "rgba(127, 217, 168, 0.85)",
  },
  seasonPillInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  seasonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  seasonTextActive: {
    color: "#171B22",
  },
  seasonTextInactive: {
    color: "#9CA3AF",
  },
  singleSeasonName: {
    color: "#6B7280",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
