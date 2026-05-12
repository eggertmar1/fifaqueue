import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { getStarRating } from "../../lib/elo";
import { supabase } from "../../lib/supabase";
import StarRating from "../../components/StarRating";
import GlassSurface from "../../components/GlassSurface";
import { displayName } from "../../lib/types";
import type { HeadToHead, Player } from "../../lib/types";
import * as ImagePicker from "expo-image-picker";

interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  currentStreak: string;
  bestStreak: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
}

interface FunStats {
  bestTeammate: { name: string; winRate: number; games: number } | null;
  worstTeammate: { name: string; winRate: number; games: number } | null;
  nemesis: { name: string; lossRate: number; games: number } | null;
  easiestOpponent: { name: string; winRate: number; games: number } | null;
  biggestWin: { score: string } | null;
  highestScoring: { score: string } | null;
}

async function fetchPlayerStats(playerId: string): Promise<PlayerStats> {
  const { data: gamePlayers } = await supabase
    .from("game_players")
    .select("*, game:games(id, status)")
    .eq("player_id", playerId);

  if (!gamePlayers) {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: 0,
      currentStreak: "-",
      bestStreak: 0,
      avgGoalsScored: 0,
      avgGoalsConceded: 0,
    };
  }

  const completedGames = gamePlayers.filter(
    (gp: any) => gp.game?.status === "completed"
  );

  if (completedGames.length === 0) {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: 0,
      currentStreak: "-",
      bestStreak: 0,
      avgGoalsScored: 0,
      avgGoalsConceded: 0,
    };
  }

  const gameIds = completedGames.map((gp: any) => gp.game_id);
  const { data: results } = await supabase
    .from("game_results")
    .select("*")
    .in("game_id", gameIds);

  const resultMap = new Map((results ?? []).map((r) => [r.game_id, r]));

  let wins = 0;
  let losses = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  const gameResults: boolean[] = [];

  for (const gp of completedGames) {
    const result = resultMap.get(gp.game_id);
    if (!result) continue;

    const winTeam = result.team1_goals > result.team2_goals ? 1 : 2;
    const didWin = gp.team === winTeam;
    gameResults.push(didWin);

    if (didWin) wins++;
    else losses++;

    totalGoalsScored += gp.team === 1 ? result.team1_goals : result.team2_goals;
    totalGoalsConceded += gp.team === 1 ? result.team2_goals : result.team1_goals;
  }

  // Calculate streaks
  let currentStreak = "-";
  let bestStreak = 0;
  let tempStreak = 0;

  if (gameResults.length > 0) {
    const lastResult = gameResults[gameResults.length - 1];
    let count = 0;
    for (let i = gameResults.length - 1; i >= 0; i--) {
      if (gameResults[i] === lastResult) count++;
      else break;
    }
    currentStreak = `${lastResult ? "W" : "L"}${count}`;

    // Best win streak
    for (const r of gameResults) {
      if (r) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
  }

  const gamesPlayed = wins + losses;

  return {
    gamesPlayed,
    wins,
    losses,
    winPct: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    currentStreak,
    bestStreak,
    avgGoalsScored: gamesPlayed > 0 ? totalGoalsScored / gamesPlayed : 0,
    avgGoalsConceded: gamesPlayed > 0 ? totalGoalsConceded / gamesPlayed : 0,
  };
}

async function fetchFunStats(playerId: string): Promise<FunStats | null> {
  // Get all game_players entries for this player
  const { data: myGames } = await supabase
    .from("game_players")
    .select("game_id, team, player_id")
    .eq("player_id", playerId);

  if (!myGames || myGames.length === 0) return null;

  const gameIds = myGames.map((g) => g.game_id);
  const myGameMap = new Map(myGames.map((g) => [g.game_id, g.team]));

  // Get all other players in these games
  const { data: allGamePlayers } = await supabase
    .from("game_players")
    .select("game_id, player_id, team")
    .in("game_id", gameIds);

  // Get all results
  const { data: results } = await supabase
    .from("game_results")
    .select("game_id, team1_goals, team2_goals")
    .in("game_id", gameIds);

  // Get all player names
  const { data: allPlayers } = await supabase
    .from("players")
    .select("id, name");

  const playerNames = new Map((allPlayers ?? []).map((p) => [p.id, p.name]));
  const resultMap = new Map((results ?? []).map((r) => [r.game_id, r]));

  // Teammate stats: { playerId -> { wins, games } }
  const teammateStats = new Map<string, { wins: number; games: number }>();
  // Opponent stats: { playerId -> { wins, losses, games } }
  const opponentStats = new Map<string, { wins: number; losses: number; games: number }>();

  for (const gp of allGamePlayers ?? []) {
    if (gp.player_id === playerId) continue;

    const myTeam = myGameMap.get(gp.game_id);
    if (myTeam === undefined) continue;

    const result = resultMap.get(gp.game_id);
    if (!result) continue;

    // Determine if it's a draw
    const isDraw = result.team1_goals === result.team2_goals;
    const winTeam = result.team1_goals > result.team2_goals ? 1 : 2;
    const iWon = !isDraw && myTeam === winTeam;
    const iLost = !isDraw && myTeam !== winTeam;

    if (gp.team === myTeam) {
      // Teammate
      const existing = teammateStats.get(gp.player_id) || { wins: 0, games: 0 };
      existing.games++;
      if (iWon) existing.wins++;
      teammateStats.set(gp.player_id, existing);
    } else {
      // Opponent
      const existing = opponentStats.get(gp.player_id) || { wins: 0, losses: 0, games: 0 };
      existing.games++;
      if (iWon) existing.wins++;
      if (iLost) existing.losses++;
      opponentStats.set(gp.player_id, existing);
    }
  }

  // Best Teammate: highest win rate among teammates with >= 2 games
  let bestTeammate: FunStats["bestTeammate"] = null;
  let bestTeammateRate = -1;
  for (const [pid, s] of teammateStats) {
    if (s.games < 2) continue;
    const rate = s.wins / s.games;
    if (rate > bestTeammateRate || (rate === bestTeammateRate && s.games > (bestTeammate?.games ?? 0))) {
      bestTeammateRate = rate;
      bestTeammate = { name: playerNames.get(pid) ?? "Unknown", winRate: Math.round(rate * 100), games: s.games };
    }
  }

  // Worst Teammate: lowest win rate among teammates with >= 2 games
  let worstTeammate: FunStats["worstTeammate"] = null;
  let worstTeammateRate = Infinity;
  for (const [pid, s] of teammateStats) {
    if (s.games < 2) continue;
    const rate = s.wins / s.games;
    if (rate < worstTeammateRate || (rate === worstTeammateRate && s.games > (worstTeammate?.games ?? 0))) {
      worstTeammateRate = rate;
      worstTeammate = { name: playerNames.get(pid) ?? "Unknown", winRate: Math.round(rate * 100), games: s.games };
    }
  }

  // Don't show worst teammate if it's the same as best (only 1 qualifying teammate)
  if (bestTeammate && worstTeammate && bestTeammate.name === worstTeammate.name) {
    worstTeammate = null;
  }

  // Nemesis: opponent you lose to most (highest loss rate, >= 2 games, at least 1 loss)
  let nemesis: FunStats["nemesis"] = null;
  let nemesisRate = -1;
  for (const [pid, s] of opponentStats) {
    if (s.games < 2 || s.losses === 0) continue;
    const decidedGames = s.wins + s.losses;
    if (decidedGames === 0) continue;
    const rate = s.losses / decidedGames;
    if (rate > nemesisRate || (rate === nemesisRate && s.games > (nemesis?.games ?? 0))) {
      nemesisRate = rate;
      nemesis = { name: playerNames.get(pid) ?? "Unknown", lossRate: Math.round(rate * 100), games: s.games };
    }
  }

  // Easiest Opponent: opponent you beat most (highest win rate, >= 2 games, at least 1 win)
  let easiestOpponent: FunStats["easiestOpponent"] = null;
  let easiestRate = -1;
  for (const [pid, s] of opponentStats) {
    if (s.games < 2 || s.wins === 0) continue;
    const decidedGames = s.wins + s.losses;
    if (decidedGames === 0) continue;
    const rate = s.wins / decidedGames;
    if (rate > easiestRate || (rate === easiestRate && s.games > (easiestOpponent?.games ?? 0))) {
      easiestRate = rate;
      easiestOpponent = { name: playerNames.get(pid) ?? "Unknown", winRate: Math.round(rate * 100), games: s.games };
    }
  }

  // Don't show easiest opponent if same as nemesis
  if (nemesis && easiestOpponent && nemesis.name === easiestOpponent.name) {
    easiestOpponent = null;
  }

  // Biggest Win: highest goal difference in a game I won
  let biggestWin: FunStats["biggestWin"] = null;
  let biggestDiff = 0;
  for (const g of myGames) {
    const result = resultMap.get(g.game_id);
    if (!result) continue;
    const myTeam = g.team;
    const myGoals = myTeam === 1 ? result.team1_goals : result.team2_goals;
    const theirGoals = myTeam === 1 ? result.team2_goals : result.team1_goals;
    const diff = myGoals - theirGoals;
    if (diff > biggestDiff) {
      biggestDiff = diff;
      biggestWin = { score: `${myGoals}-${theirGoals}` };
    }
  }

  // Highest Scoring: game with most total goals
  let highestScoring: FunStats["highestScoring"] = null;
  let maxTotalGoals = 0;
  for (const g of myGames) {
    const result = resultMap.get(g.game_id);
    if (!result) continue;
    const total = result.team1_goals + result.team2_goals;
    if (total > maxTotalGoals) {
      maxTotalGoals = total;
      const myTeam = g.team;
      const myGoals = myTeam === 1 ? result.team1_goals : result.team2_goals;
      const theirGoals = myTeam === 1 ? result.team2_goals : result.team1_goals;
      highestScoring = { score: `${myGoals}-${theirGoals}` };
    }
  }

  return {
    bestTeammate,
    worstTeammate,
    nemesis,
    easiestOpponent,
    biggestWin,
    highestScoring,
  };
}

async function fetchHeadToHead(playerId: string): Promise<HeadToHead[]> {
  const { data: allPlayers } = await supabase
    .from("players")
    .select("*")
    .neq("id", playerId);

  if (!allPlayers) return [];

  const { data: myGames } = await supabase
    .from("game_players")
    .select("game_id, team")
    .eq("player_id", playerId);

  if (!myGames || myGames.length === 0) {
    return allPlayers.map((p) => ({
      opponent: p,
      gamesAsTeammates: 0,
      gamesAsOpponents: 0,
      winsAgainst: 0,
      lossesAgainst: 0,
    }));
  }

  const gameIds = myGames.map((g) => g.game_id);
  const myGameMap = new Map(myGames.map((g) => [g.game_id, g.team]));

  const { data: otherPlayers } = await supabase
    .from("game_players")
    .select("game_id, player_id, team")
    .in("game_id", gameIds)
    .neq("player_id", playerId);

  const { data: results } = await supabase
    .from("game_results")
    .select("*")
    .in("game_id", gameIds);

  const resultMap = new Map((results ?? []).map((r) => [r.game_id, r]));

  const h2hMap = new Map<
    string,
    { asTeam: number; asOpp: number; winsAgainst: number; lossesAgainst: number }
  >();

  for (const op of otherPlayers ?? []) {
    const myTeam = myGameMap.get(op.game_id);
    if (myTeam === undefined) continue;

    const existing = h2hMap.get(op.player_id) || {
      asTeam: 0,
      asOpp: 0,
      winsAgainst: 0,
      lossesAgainst: 0,
    };

    const result = resultMap.get(op.game_id);
    const winTeam = result
      ? result.team1_goals > result.team2_goals
        ? 1
        : 2
      : null;

    if (op.team === myTeam) {
      existing.asTeam++;
    } else {
      existing.asOpp++;
      if (winTeam !== null) {
        if (myTeam === winTeam) existing.winsAgainst++;
        else existing.lossesAgainst++;
      }
    }

    h2hMap.set(op.player_id, existing);
  }

  return allPlayers.map((p) => {
    const stats = h2hMap.get(p.id);
    return {
      opponent: p,
      gamesAsTeammates: stats?.asTeam ?? 0,
      gamesAsOpponents: stats?.asOpp ?? 0,
      winsAgainst: stats?.winsAgainst ?? 0,
      lossesAgainst: stats?.lossesAgainst ?? 0,
    };
  });
}

async function fetchMaxElo(): Promise<number> {
  const { data } = await supabase
    .from("players")
    .select("elo")
    .order("elo", { ascending: false })
    .limit(1)
    .single();
  return data?.elo ?? 1000;
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassSurface style={styles.statBox} fallbackStyle={styles.softCardFallback}>
      <Text style={styles.statBoxLabel}>{label}</Text>
      <Text style={styles.statBoxValue}>{value}</Text>
    </GlassSurface>
  );
}

function FunStatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <GlassSurface style={styles.funStatCard} fallbackStyle={styles.softCardFallback}>
      <Text style={styles.funStatLabel}>{label}</Text>
      <Text style={styles.funStatValue} numberOfLines={1}>{value}</Text>
      {detail ? <Text style={styles.funStatDetail}>{detail}</Text> : null}
    </GlassSurface>
  );
}

export default function ProfileScreen() {
  const { player, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ playerId?: string }>();

  const viewedId =
    typeof params.playerId === "string" && params.playerId !== player?.id
      ? params.playerId
      : player?.id;
  const isOwnProfile = !!player && viewedId === player.id;

  const [viewedPlayer, setViewedPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [funStats, setFunStats] = useState<FunStats | null>(null);
  const [h2h, setH2h] = useState<HeadToHead[]>([]);
  const [maxElo, setMaxElo] = useState(1000);
  const [loading, setLoading] = useState(true);

  // Nickname editing state (own profile only)
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState("");
  const [localNickname, setLocalNickname] = useState<string | null>(null);
  const nicknameInputRef = useRef<TextInput>(null);

  // Avatar state (own profile only)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!viewedId) return;
    setLoading(true);
    (async () => {
      const { data: vp } = await supabase
        .from("players")
        .select("*")
        .eq("id", viewedId)
        .maybeSingle();
      if (vp) {
        setViewedPlayer(vp);
        setLocalNickname(vp.nickname);
        setLocalAvatarUrl(vp.avatar_url);
      }
      const [s, h, m, f] = await Promise.all([
        fetchPlayerStats(viewedId),
        fetchHeadToHead(viewedId),
        fetchMaxElo(),
        fetchFunStats(viewedId),
      ]);
      setStats(s);
      setH2h(h);
      setMaxElo(m);
      setFunStats(f);
      setLoading(false);
    })();
  }, [viewedId]);

  const handleNicknameTap = () => {
    if (!player || !isOwnProfile) return;
    setNicknameValue(localNickname || player.name);
    setEditingNickname(true);
    // Focus after state update renders the input
    setTimeout(() => nicknameInputRef.current?.focus(), 100);
  };

  const handleNicknameSave = async () => {
    if (!player || !isOwnProfile) return;
    setEditingNickname(false);
    const trimmed = nicknameValue.trim();
    // If empty or same as Google name, clear nickname
    const newNickname = trimmed === "" || trimmed === player.name ? null : trimmed;
    setLocalNickname(newNickname);
    await supabase
      .from("players")
      .update({ nickname: newNickname })
      .eq("id", player.id);
  };

  const handleAvatarTap = async () => {
    if (!player || !isOwnProfile || uploadingAvatar) return;

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Please allow access to your photo library to change your avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const uri = asset.uri;

      // Fetch the image as a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      const filePath = `${player.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        Alert.alert("Upload failed", uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Append cache-buster so the image reloads
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase
        .from("players")
        .update({ avatar_url: publicUrl })
        .eq("id", player.id);

      setLocalAvatarUrl(publicUrl);
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? "Unknown error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!player) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#171B22", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#9CA3AF", fontSize: 16, marginBottom: 20 }}>Not signed in</Text>
        <Pressable
          onPress={signOut}
          style={{ backgroundColor: "rgba(217, 112, 112, 0.85)", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 999 }}
        >
          <Text style={{ color: "#171B22", fontWeight: "700", fontSize: 15 }}>Sign Out & Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (loading || !viewedPlayer) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#7FD9A8" size="large" />
      </SafeAreaView>
    );
  }

  // For own profile, apply optimistic nickname/avatar overrides
  const displayedPlayer: Player = isOwnProfile
    ? {
        ...viewedPlayer,
        nickname: localNickname ?? viewedPlayer.nickname,
        avatar_url: localAvatarUrl ?? viewedPlayer.avatar_url,
      }
    : viewedPlayer;

  const avatarUri =
    displayedPlayer.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayedPlayer.name)}&background=2A2A2A&color=fff`;
  const starRating = getStarRating(displayedPlayer.elo, maxElo);

  const hasEnoughGames = (stats?.gamesPlayed ?? 0) >= 3;
  const hasFunStats = funStats && (
    funStats.bestTeammate ||
    funStats.worstTeammate ||
    funStats.nemesis ||
    funStats.easiestOpponent ||
    funStats.biggestWin ||
    funStats.highestScoring
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerTitle}>
          {!isOwnProfile && (
            <Pressable onPress={() => router.replace("/profile")} hitSlop={8}>
              <Text style={styles.backLink}>{"\u2190 Back"}</Text>
            </Pressable>
          )}
          <Text style={styles.titleText}>
            {isOwnProfile ? "Profile" : displayName(displayedPlayer)}
          </Text>
        </View>

        {/* Player Header */}
        <View style={styles.playerHeader}>
          {/* Avatar with camera overlay (own profile only) */}
          <Pressable
            onPress={isOwnProfile ? handleAvatarTap : undefined}
            style={styles.avatarContainer}
          >
            <Image
              source={{ uri: avatarUri }}
              style={styles.avatar}
            />
            {isOwnProfile && uploadingAvatar ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : isOwnProfile ? (
              <View style={styles.cameraIconBadge}>
                <Text style={styles.cameraIconText}>📷</Text>
              </View>
            ) : null}
          </Pressable>

          {/* Nickname / Name with pencil indicator (own profile only) */}
          {isOwnProfile && editingNickname ? (
            <TextInput
              ref={nicknameInputRef}
              style={styles.nicknameInput}
              value={nicknameValue}
              onChangeText={setNicknameValue}
              onBlur={handleNicknameSave}
              onSubmitEditing={handleNicknameSave}
              returnKeyType="done"
              maxLength={30}
              placeholder="Enter nickname"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
            />
          ) : isOwnProfile ? (
            <Pressable onPress={handleNicknameTap} style={styles.nameRow}>
              <Text style={styles.playerName}>{displayName(displayedPlayer)}</Text>
              <Text style={styles.pencilIcon}>✏️</Text>
            </Pressable>
          ) : (
            <Text style={styles.playerName}>{displayName(displayedPlayer)}</Text>
          )}

          {/* Show Google name underneath if nickname differs */}
          {displayedPlayer.nickname && !editingNickname && (
            <Text style={styles.googleNameSubtitle}>{displayedPlayer.name}</Text>
          )}

          <Text style={styles.eloText}>
            {displayedPlayer.elo} ELO
          </Text>
          <View style={styles.starRatingWrapper}>
            <StarRating rating={starRating} />
          </View>
        </View>

        {/* Stats Grid */}
        {stats && (
          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <StatBox label="Games" value={stats.gamesPlayed} />
              <StatBox label="Wins" value={stats.wins} />
              <StatBox label="Losses" value={stats.losses} />
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Win%" value={`${stats.winPct}%`} />
              <StatBox label="Streak" value={stats.currentStreak} />
              <StatBox label="Best Streak" value={`W${stats.bestStreak}`} />
            </View>
            <View style={styles.statsRowMt}>
              <StatBox
                label="Avg Scored"
                value={stats.avgGoalsScored.toFixed(1)}
              />
              <StatBox
                label="Avg Conceded"
                value={stats.avgGoalsConceded.toFixed(1)}
              />
            </View>
          </View>
        )}

        {/* Fun Stats */}
        <View style={styles.funStatsSection}>
          <Text style={styles.funStatsTitle}>Fun Stats</Text>
          {!hasEnoughGames ? (
            <Text style={styles.funStatsLocked}>
              Play more games to unlock stats
            </Text>
          ) : !hasFunStats ? (
            <Text style={styles.funStatsLocked}>
              Play more games to unlock stats
            </Text>
          ) : (
            <View style={styles.funStatsGrid}>
              {funStats.bestTeammate && (
                <FunStatCard
                  label="Best Teammate"
                  value={funStats.bestTeammate.name}
                  detail={`${funStats.bestTeammate.winRate}% win rate (${funStats.bestTeammate.games} games)`}
                />
              )}
              {funStats.worstTeammate && (
                <FunStatCard
                  label="Worst Teammate"
                  value={funStats.worstTeammate.name}
                  detail={`${funStats.worstTeammate.winRate}% win rate (${funStats.worstTeammate.games} games)`}
                />
              )}
              {funStats.nemesis && (
                <FunStatCard
                  label="Nemesis"
                  value={funStats.nemesis.name}
                  detail={`${funStats.nemesis.lossRate}% loss rate (${funStats.nemesis.games} games)`}
                />
              )}
              {funStats.easiestOpponent && (
                <FunStatCard
                  label="Easiest Opponent"
                  value={funStats.easiestOpponent.name}
                  detail={`${funStats.easiestOpponent.winRate}% win rate (${funStats.easiestOpponent.games} games)`}
                />
              )}
              {funStats.biggestWin && (
                <FunStatCard
                  label="Biggest Win"
                  value={funStats.biggestWin.score}
                />
              )}
              {funStats.highestScoring && (
                <FunStatCard
                  label="Most Goals in a Game"
                  value={funStats.highestScoring.score}
                />
              )}
            </View>
          )}
        </View>

        {/* Head-to-Head */}
        <View style={styles.h2hSection}>
          <Text style={styles.h2hTitle}>
            Head-to-Head
          </Text>
          {h2h
            .sort((a, b) => b.gamesAsOpponents - a.gamesAsOpponents)
            .map((record) => {
              const oppAvatar =
                record.opponent.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(record.opponent.name)}&background=2A2A2A&color=fff`;
              return (
                <GlassSurface
                  key={record.opponent.id}
                  style={styles.h2hRow}
                  fallbackStyle={styles.softCardFallback}
                >
                  <Image
                    source={{ uri: oppAvatar }}
                    style={styles.h2hAvatar}
                  />
                  <Text
                    style={styles.h2hName}
                    numberOfLines={1}
                  >
                    {displayName(record.opponent)}
                  </Text>
                  <View style={styles.h2hRecord}>
                    <Text style={styles.h2hWins}>
                      {record.winsAgainst}W
                    </Text>
                    <Text style={styles.h2hDash}>-</Text>
                    <Text style={styles.h2hLosses}>
                      {record.lossesAgainst}L
                    </Text>
                  </View>
                </GlassSurface>
              );
            })}
          {h2h.length === 0 && (
            <Text style={styles.h2hEmpty}>
              No other players yet
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#171B22",
    alignItems: "center",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#171B22",
  },
  softCardFallback: {
    backgroundColor: "rgba(42, 46, 52, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleText: {
    color: "#E8E8E8",
    fontSize: 24,
    fontWeight: "700",
  },
  backLink: {
    color: "#7FD9A8",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  playerHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 9999,
    borderWidth: 3,
    borderColor: "rgba(127, 217, 168, 0.7)",
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(42, 46, 52, 0.95)",
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#171B22",
  },
  cameraIconText: {
    fontSize: 14,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    color: "#E8E8E8",
    fontSize: 20,
    fontWeight: "700",
  },
  pencilIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  googleNameSubtitle: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 2,
  },
  nicknameInput: {
    color: "#E8E8E8",
    fontSize: 20,
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: "rgba(127, 217, 168, 0.7)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 160,
    textAlign: "center",
  },
  eloText: {
    color: "#7FD9A8",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
  },
  starRatingWrapper: {
    marginTop: 4,
  },
  statsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statsRowMt: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  statBox: {
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    flex: 1,
    overflow: "hidden",
  },
  statBoxLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
  },
  statBoxValue: {
    color: "#E8E8E8",
    fontSize: 18,
    fontWeight: "700",
  },
  funStatsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  funStatsTitle: {
    color: "#E8E8E8",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  funStatsLocked: {
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    overflow: "hidden",
  },
  funStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  funStatCard: {
    borderRadius: 14,
    padding: 12,
    width: "48.5%",
    minWidth: 150,
    flexGrow: 1,
    overflow: "hidden",
  },
  funStatLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 4,
  },
  funStatValue: {
    color: "#7FD9A8",
    fontSize: 16,
    fontWeight: "700",
  },
  funStatDetail: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
  },
  h2hSection: {
    paddingHorizontal: 24,
    paddingBottom: 140,
  },
  h2hTitle: {
    color: "#E8E8E8",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  h2hRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  h2hAvatar: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  h2hName: {
    color: "#E8E8E8",
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
  h2hRecord: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  h2hWins: {
    color: "#7FD9A8",
    fontWeight: "700",
  },
  h2hDash: {
    color: "#4B5563",
  },
  h2hLosses: {
    color: "#D97070",
    fontWeight: "700",
  },
  h2hEmpty: {
    color: "#6B7280",
    textAlign: "center",
    paddingVertical: 16,
  },
});
