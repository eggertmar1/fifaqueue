import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import type { QueueEntry } from "../lib/types";

interface QueueListProps {
  entries: QueueEntry[];
  currentPlayerId: string | undefined;
}

function QueueRow({
  entry,
  isCurrentPlayer,
}: {
  entry: QueueEntry;
  isCurrentPlayer: boolean;
}) {
  const player = entry.player;
  const avatarUri =
    player?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(player?.name || "?")}&background=2A2A2A&color=fff`;

  return (
    <View
      style={[
        styles.row,
        isCurrentPlayer ? styles.rowHighlighted : styles.rowDefault,
      ]}
    >
      <Image source={{ uri: avatarUri }} style={styles.avatar} />
      <Text style={styles.playerName} numberOfLines={1}>
        {player?.name || "Unknown"}
      </Text>
      <View style={styles.eloBadge}>
        <Text style={styles.eloText}>{player?.elo ?? 1000}</Text>
      </View>
      {entry.games_today > 0 && (
        <View style={styles.gamesTodayBadge}>
          <Text style={styles.gamesTodayText}>
            {entry.games_today} {entry.games_today === 1 ? "game" : "games"}
          </Text>
        </View>
      )}
      {entry.status === "playing" && (
        <View style={styles.playingBadge}>
          <Text style={styles.playingText}>PLAYING</Text>
        </View>
      )}
    </View>
  );
}

export default function QueueList({ entries, currentPlayerId }: QueueListProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No players registered yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <QueueRow
          entry={item}
          isCurrentPlayer={item.player_id === currentPlayerId}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  rowDefault: {
    backgroundColor: "#2A2A2A",
  },
  rowHighlighted: {
    backgroundColor: "rgba(0, 210, 106, 0.15)",
    borderWidth: 1,
    borderColor: "#00D26A",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#333333",
  },
  playerName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  eloBadge: {
    backgroundColor: "#1E1E1E",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  eloText: {
    color: "#00D26A",
    fontWeight: "700",
    fontSize: 14,
  },
  gamesTodayBadge: {
    backgroundColor: "rgba(136, 136, 136, 0.2)",
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  gamesTodayText: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "600",
  },
  playingBadge: {
    backgroundColor: "rgba(255, 184, 0, 0.2)",
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  playingText: {
    color: "#FFB800",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
  },
});
