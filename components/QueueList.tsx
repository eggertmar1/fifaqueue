import { View, Text, FlatList, Image, StyleSheet, Platform } from "react-native";
import GlassSurface from "./GlassSurface";
import { displayName } from "../lib/types";
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
    <GlassSurface
      style={[styles.row, isCurrentPlayer && styles.rowHighlightedBorder]}
      fallbackStyle={isCurrentPlayer ? styles.rowHighlightedFallback : styles.rowDefaultFallback}
      tintColor={isCurrentPlayer ? "rgba(127, 217, 168, 0.18)" : undefined}
    >
      <Image source={{ uri: avatarUri }} style={styles.avatar} />
      <Text style={styles.playerName} numberOfLines={1}>
        {player ? displayName(player) : "Unknown"}
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
    </GlassSurface>
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
      contentContainerStyle={Platform.OS === "ios" ? styles.listContent : undefined}
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
    borderRadius: 16,
    overflow: "hidden",
  },
  rowDefaultFallback: {
    backgroundColor: "rgba(42, 46, 52, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rowHighlightedFallback: {
    backgroundColor: "rgba(127, 217, 168, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(127, 217, 168, 0.4)",
  },
  rowHighlightedBorder: {
    borderWidth: 1,
    borderColor: "rgba(127, 217, 168, 0.45)",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  playerName: {
    color: "#E8E8E8",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  eloBadge: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  eloText: {
    color: "#7FD9A8",
    fontWeight: "700",
    fontSize: 14,
  },
  gamesTodayBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(212, 180, 117, 0.18)",
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  playingText: {
    color: "#D4B475",
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
  listContent: {
    paddingBottom: 130,
  },
});
