import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { useState, useCallback } from "react";
import StarRating from "./StarRating";
import FifaTeamReveal from "./FifaTeamReveal";
import { getStarRating } from "../lib/elo";
import { getRandomTeamForStars, getTeamsForStars } from "../lib/fifa-teams";
import type { FifaTeam } from "../lib/fifa-teams";
import type { GamePlayer, Player } from "../lib/types";

interface ActiveGameProps {
  gamePlayers: (GamePlayer & { player?: Player })[];
  maxElo: number;
}

function pickTwoDistinctTeams(stars1: number, stars2: number): [FifaTeam, FifaTeam] {
  const team1 = getRandomTeamForStars(stars1);
  let team2 = getRandomTeamForStars(stars2);
  // Retry up to 20 times to avoid same team
  let attempts = 0;
  while (team2.name === team1.name && attempts < 20) {
    team2 = getRandomTeamForStars(stars2);
    attempts++;
  }
  return [team1, team2];
}

function TeamCard({
  team,
  players,
  maxElo,
  fifaTeam,
  onReroll,
}: {
  team: 1 | 2;
  players: (GamePlayer & { player?: Player })[];
  maxElo: number;
  fifaTeam: FifaTeam | null;
  onReroll?: () => void;
}) {
  const avgElo =
    players.reduce((sum, gp) => sum + gp.elo_before, 0) / players.length;
  const stars = getStarRating(avgElo, maxElo);

  return (
    <View style={styles.teamCard}>
      <Text style={styles.teamLabel}>
        TEAM {team}
      </Text>
      <View style={styles.playersRow}>
        {players.map((gp) => {
          const avatarUri =
            gp.player?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(gp.player?.name || "?")}&background=2A2A2A&color=fff`;
          return (
            <View key={gp.id} style={styles.playerContainer}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
              />
              <Text
                style={styles.playerName}
                numberOfLines={1}
              >
                {gp.player?.name?.split(" ")[0] || "?"}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.eloText}>
        {Math.round(avgElo)} ELO
      </Text>
      <StarRating rating={stars} />
      {fifaTeam && (
        <FifaTeamReveal team={fifaTeam} onReroll={onReroll} />
      )}
    </View>
  );
}

export default function ActiveGame({ gamePlayers, maxElo }: ActiveGameProps) {
  const [showFifaTeams, setShowFifaTeams] = useState(false);
  const [fifaTeam1, setFifaTeam1] = useState<FifaTeam | null>(null);
  const [fifaTeam2, setFifaTeam2] = useState<FifaTeam | null>(null);

  const team1Players = gamePlayers.filter((gp) => gp.team === 1);
  const team2Players = gamePlayers.filter((gp) => gp.team === 2);

  const stars1 = getStarRating(
    team1Players.reduce((sum, gp) => sum + gp.elo_before, 0) / team1Players.length,
    maxElo
  );
  const stars2 = getStarRating(
    team2Players.reduce((sum, gp) => sum + gp.elo_before, 0) / team2Players.length,
    maxElo
  );

  const rollBoth = useCallback(() => {
    const [t1, t2] = pickTwoDistinctTeams(stars1, stars2);
    setFifaTeam1(t1);
    setFifaTeam2(t2);
  }, [stars1, stars2]);

  const rerollTeam1 = useCallback(() => {
    let newTeam = getRandomTeamForStars(stars1);
    let attempts = 0;
    while (fifaTeam2 && newTeam.name === fifaTeam2.name && attempts < 20) {
      newTeam = getRandomTeamForStars(stars1);
      attempts++;
    }
    setFifaTeam1(newTeam);
  }, [stars1, fifaTeam2]);

  const rerollTeam2 = useCallback(() => {
    let newTeam = getRandomTeamForStars(stars2);
    let attempts = 0;
    while (fifaTeam1 && newTeam.name === fifaTeam1.name && attempts < 20) {
      newTeam = getRandomTeamForStars(stars2);
      attempts++;
    }
    setFifaTeam2(newTeam);
  }, [stars2, fifaTeam1]);

  const handleToggle = () => {
    if (!showFifaTeams) {
      rollBoth();
    } else {
      setFifaTeam1(null);
      setFifaTeam2(null);
    }
    setShowFifaTeams(!showFifaTeams);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Now Playing
      </Text>
      <View style={styles.matchRow}>
        <TeamCard
          team={1}
          players={team1Players}
          maxElo={maxElo}
          fifaTeam={showFifaTeams ? fifaTeam1 : null}
          onReroll={rerollTeam1}
        />
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        <TeamCard
          team={2}
          players={team2Players}
          maxElo={maxElo}
          fifaTeam={showFifaTeams ? fifaTeam2 : null}
          onReroll={rerollTeam2}
        />
      </View>
      <Pressable
        onPress={handleToggle}
        style={[styles.toggleButton, showFifaTeams && styles.toggleButtonActive]}
      >
        <Text style={[styles.toggleText, showFifaTeams && styles.toggleTextActive]}>
          {showFifaTeams ? "Hide FIFA Teams" : "Random FIFA Teams"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  heading: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  teamCard: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  teamLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 1,
  },
  playersRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  playerContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: "#333333",
  },
  playerName: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  eloText: {
    color: "#00D26A",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  vsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  vsText: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 24,
  },
  toggleButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
    alignSelf: "center",
  },
  toggleButtonActive: {
    backgroundColor: "rgba(0, 210, 106, 0.15)",
    borderColor: "#00D26A",
  },
  toggleText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#00D26A",
  },
});
