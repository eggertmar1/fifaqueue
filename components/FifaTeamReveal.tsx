import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useRef, useState } from "react";
import FifaTeamBadge from "./FifaTeamBadge";
import { getTeamsForStars } from "../lib/fifa-teams";
import type { FifaTeam } from "../lib/fifa-teams";

interface FifaTeamRevealProps {
  team: FifaTeam;
  onReroll?: () => void;
}

export default function FifaTeamReveal({ team, onReroll }: FifaTeamRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTeamRef = useRef(team.name);

  // Animation pool: same exact half-star tier as the revealed team.
  const pool = getTeamsForStars(team.stars);

  function runAnimation() {
    setRevealed(false);
    let tick = 0;
    const totalTicks = 20;

    intervalRef.current = setInterval(() => {
      tick++;
      const randomTeam = pool[Math.floor(Math.random() * pool.length)];
      setDisplayName(randomTeam?.name || "");

      if (tick >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayName(team.name);
        setRevealed(true);
      }
    }, 75);
  }

  useEffect(() => {
    // Run animation when team changes
    if (team.name !== prevTeamRef.current || !revealed) {
      prevTeamRef.current = team.name;
      runAnimation();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [team.name]);

  if (revealed) {
    return (
      <View style={styles.container}>
        <FifaTeamBadge teamName={team.name} size={44} />
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.leagueName} numberOfLines={1}>
          {team.league}
        </Text>
        {onReroll && (
          <Pressable onPress={onReroll} style={styles.rerollButton}>
            <Text style={styles.rerollText}>Re-roll</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.teamName, styles.animatingText]} numberOfLines={1}>
        {displayName || "..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    alignItems: "center",
    minHeight: 90,
    justifyContent: "center",
  },
  teamName: {
    color: "#E8E8E8",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  animatingText: {
    color: "#7FD9A8",
    fontSize: 16,
  },
  leagueName: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
  rerollButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
  },
  rerollText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },
});
