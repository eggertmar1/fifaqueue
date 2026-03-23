import { View, Text, Pressable, Image } from "react-native";
import type { Player } from "../lib/types";

interface PlayerCardProps {
  player: Player;
  onPress?: () => void;
}

export default function PlayerCard({ player, onPress }: PlayerCardProps) {
  return (
    <Pressable onPress={onPress} className="items-center">
      <View className="relative">
        <Image
          source={{
            uri: player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=2A2A2A&color=fff`,
          }}
          className="w-14 h-14 rounded-full border-2 border-dark-border"
        />
        <View className="absolute -bottom-1 -right-1 bg-primary rounded-full px-1.5 py-0.5">
          <Text className="text-white text-xs font-bold">{player.elo}</Text>
        </View>
      </View>
      <Text className="text-white text-sm mt-1.5 font-medium" numberOfLines={1}>
        {player.name}
      </Text>
    </Pressable>
  );
}
