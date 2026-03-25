import { View, Text, FlatList, Image, Pressable, StyleSheet } from "react-native";
import { displayName } from "../lib/types";
import type { LeaderboardEntry } from "../lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string | undefined;
  onPlayerPress?: (playerId: string) => void;
}

function LeaderboardRow({
  entry,
  isCurrentPlayer,
  onPress,
}: {
  entry: LeaderboardEntry;
  isCurrentPlayer: boolean;
  onPress?: () => void;
}) {
  const streakColor = entry.streak.startsWith("W")
    ? "#00D26A"
    : entry.streak.startsWith("L")
      ? "#EF4444"
      : "#6B7280";

  const avatarUri =
    entry.player.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.player.name)}&background=2A2A2A&color=fff`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        isCurrentPlayer ? styles.rowCurrentPlayer : styles.rowDefault,
      ]}
    >
      <Text
        style={[
          styles.rankText,
          entry.rank <= 3 ? styles.textAccent : styles.textGray400,
        ]}
      >
        {entry.rank}
      </Text>
      <Image source={{ uri: avatarUri }} style={styles.avatar} />
      <Text style={styles.playerName} numberOfLines={1}>
        {displayName(entry.player)}
      </Text>
      <Text style={styles.eloText}>{entry.elo}</Text>
      <Text style={styles.winsText}>{entry.wins}W</Text>
      <Text style={styles.lossesText}>{entry.losses}L</Text>
      <Text style={styles.winPctText}>{entry.winPct}%</Text>
      <Text style={[styles.streakText, { color: streakColor }]}>
        {entry.streak || "-"}
      </Text>
      <Text style={styles.avgGoalsText}>{entry.avgGoals.toFixed(1)}</Text>
    </Pressable>
  );
}

export default function LeaderboardTable({
  entries,
  currentPlayerId,
  onPlayerPress,
}: LeaderboardTableProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.w8, styles.textCenter]}>#</Text>
        <View style={styles.headerAvatarSpacer} />
        <Text style={[styles.headerCell, styles.ml2, styles.flex1]}>Player</Text>
        <Text style={[styles.headerCell, styles.w12, styles.textRight]}>ELO</Text>
        <Text style={[styles.headerCell, styles.w10, styles.textCenter]}>W</Text>
        <Text style={[styles.headerCell, styles.w10, styles.textCenter]}>L</Text>
        <Text style={[styles.headerCell, styles.w12, styles.textCenter]}>Win%</Text>
        <Text style={[styles.headerCell, styles.w8, styles.textCenter]}>Str</Text>
        <Text style={[styles.headerCell, styles.w8, styles.textRight]}>Avg</Text>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.player.id}
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            isCurrentPlayer={item.player.id === currentPlayerId}
            onPress={() => onPlayerPress?.(item.player.id)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  headerCell: {
    color: "#6B7280",
    fontSize: 12,
  },
  headerAvatarSpacer: {
    width: 36,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 12,
  },
  rowDefault: {
    backgroundColor: "#2A2A2A",
  },
  rowCurrentPlayer: {
    backgroundColor: "rgba(0, 210, 106, 0.15)",
    borderWidth: 1,
    borderColor: "#00D26A",
  },
  rankText: {
    width: 32,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  textAccent: {
    color: "#FFB800",
  },
  textGray400: {
    color: "#9CA3AF",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: "#333333",
  },
  playerName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  eloText: {
    color: "#00D26A",
    fontWeight: "700",
    fontSize: 14,
    width: 48,
    textAlign: "right",
  },
  winsText: {
    color: "#9CA3AF",
    fontSize: 12,
    width: 40,
    textAlign: "center",
  },
  lossesText: {
    color: "#9CA3AF",
    fontSize: 12,
    width: 40,
    textAlign: "center",
  },
  winPctText: {
    color: "#9CA3AF",
    fontSize: 12,
    width: 48,
    textAlign: "center",
  },
  streakText: {
    fontWeight: "700",
    fontSize: 12,
    width: 32,
    textAlign: "center",
  },
  avgGoalsText: {
    color: "#9CA3AF",
    fontSize: 12,
    width: 32,
    textAlign: "right",
  },
  // Reusable layout helpers for header cells
  w8: {
    width: 32,
  },
  w10: {
    width: 40,
  },
  w12: {
    width: 48,
  },
  ml2: {
    marginLeft: 8,
  },
  flex1: {
    flex: 1,
  },
  textCenter: {
    textAlign: "center",
  },
  textRight: {
    textAlign: "right",
  },
});
