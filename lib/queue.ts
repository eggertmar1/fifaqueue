import { supabase } from "./supabase";
import type { Game, GamePlayer, QueueEntry, Season } from "./types";

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function assignTeams(
  playerIds: string[]
): { playerId: string; team: 1 | 2 }[] {
  const shuffled = shuffle(playerIds);
  if (shuffled.length === 2) {
    return [
      { playerId: shuffled[0], team: 1 },
      { playerId: shuffled[1], team: 2 },
    ];
  }
  if (shuffled.length === 3) {
    // 2v1: random team gets 2 players
    const bigTeam: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
    const smallTeam: 1 | 2 = bigTeam === 1 ? 2 : 1;
    return [
      { playerId: shuffled[0], team: bigTeam },
      { playerId: shuffled[1], team: bigTeam },
      { playerId: shuffled[2], team: smallTeam },
    ];
  }
  // 4 players: 2v2
  return [
    { playerId: shuffled[0], team: 1 },
    { playerId: shuffled[1], team: 1 },
    { playerId: shuffled[2], team: 2 },
    { playerId: shuffled[3], team: 2 },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of player IDs who played in at least one completed game
 * yesterday for the given season.
 */
async function getYesterdayPlayerIds(seasonId: string): Promise<Set<string>> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: yesterdayGames } = await supabase
    .from("games")
    .select("id")
    .eq("season_id", seasonId)
    .eq("date", yesterdayStr)
    .eq("status", "completed");

  if (!yesterdayGames || yesterdayGames.length === 0) return new Set();

  const gameIds = yesterdayGames.map((g) => g.id);
  const { data: players } = await supabase
    .from("game_players")
    .select("player_id")
    .in("game_id", gameIds);

  return new Set((players ?? []).map((p) => p.player_id));
}

/**
 * Weighted selection of up to `count` players from `candidates`.
 *
 * Priority 1 — players who did NOT play yesterday (guaranteed a spot).
 * Priority 2 — players with the fewest `games_today`.
 * Priority 3 — random from the rest.
 *
 * If any priority group has more candidates than remaining spots, a random
 * subset of that group is chosen.
 */
function weightedSelect(
  candidates: (QueueEntry & { player: { id: string; elo: number } })[],
  yesterdayPlayerIds: Set<string>,
  count: number
): (QueueEntry & { player: { id: string; elo: number } })[] {
  const selected: (QueueEntry & { player: { id: string; elo: number } })[] = [];
  let remaining = [...candidates];

  // --- Priority 1: didn't play yesterday ---
  const didntPlayYesterday = remaining.filter(
    (e) => !yesterdayPlayerIds.has(e.player_id)
  );
  const playedYesterday = remaining.filter((e) =>
    yesterdayPlayerIds.has(e.player_id)
  );

  if (didntPlayYesterday.length <= count) {
    selected.push(...didntPlayYesterday);
  } else {
    selected.push(...shuffle(didntPlayYesterday).slice(0, count));
  }

  if (selected.length >= count) return selected.slice(0, count);

  remaining = playedYesterday;

  // --- Priority 2: fewest games_today ---
  remaining.sort((a, b) => (a.games_today ?? 0) - (b.games_today ?? 0));
  const spotsLeft = count - selected.length;

  if (remaining.length > 0) {
    const minGames = remaining[0].games_today ?? 0;
    const fewest = remaining.filter((e) => (e.games_today ?? 0) === minGames);
    const rest = remaining.filter((e) => (e.games_today ?? 0) !== minGames);

    if (fewest.length <= spotsLeft) {
      selected.push(...fewest);
      remaining = rest;
    } else {
      selected.push(...shuffle(fewest).slice(0, spotsLeft));
      return selected.slice(0, count);
    }
  }

  if (selected.length >= count) return selected.slice(0, count);

  // --- Priority 3: random from whatever is left ---
  const finalSpotsLeft = count - selected.length;
  selected.push(...shuffle(remaining).slice(0, finalSpotsLeft));

  return selected.slice(0, count);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCurrentSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from("seasons")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as Season;
}

export async function getTodayPool(seasonId: string): Promise<QueueEntry[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("season_id", seasonId)
    .eq("date", todayDate())
    .in("status", ["registered", "playing"])
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as QueueEntry[];
}

export async function getActiveGame(
  seasonId: string
): Promise<(Game & { game_players: GamePlayer[] }) | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*, game_players(*, player:players(*))")
    .eq("season_id", seasonId)
    .eq("date", todayDate())
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Game & { game_players: GamePlayer[] };
}

export async function registerForPool(
  playerId: string,
  seasonId: string
): Promise<void> {
  const today = todayDate();

  // Check if already registered or playing today
  const { data: existing } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("player_id", playerId)
    .eq("date", today)
    .in("status", ["registered", "playing"])
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("Already registered for today's pool");
  }

  const { error } = await supabase.from("queue_entries").insert({
    player_id: playerId,
    season_id: seasonId,
    date: today,
    position: 0,
    status: "registered",
    games_today: 0,
  });

  if (error) throw error;
}

export async function leavePool(playerId: string): Promise<void> {
  const today = todayDate();

  const { data: entry } = await supabase
    .from("queue_entries")
    .select("id")
    .eq("player_id", playerId)
    .eq("date", today)
    .eq("status", "registered")
    .limit(1)
    .single();

  if (!entry) throw new Error("Not in pool");

  const { error } = await supabase
    .from("queue_entries")
    .delete()
    .eq("id", entry.id);

  if (error) throw error;
}

export async function startGame(
  seasonId: string
): Promise<Game & { game_players: GamePlayer[] }> {
  const today = todayDate();

  // Get all registered entries for today with player data
  const { data: registeredEntries, error: poolError } = await supabase
    .from("queue_entries")
    .select("*, player:players(*)")
    .eq("season_id", seasonId)
    .eq("date", today)
    .eq("status", "registered")
    .order("joined_at", { ascending: true });

  if (poolError) throw poolError;
  if (!registeredEntries || registeredEntries.length < 2) {
    throw new Error("Need at least 2 players to start a game");
  }

  const entries = registeredEntries as (QueueEntry & {
    player: { id: string; elo: number };
  })[];

  // Weighted selection: pick up to 4 players
  const yesterdayIds = await getYesterdayPlayerIds(seasonId);
  const selected = weightedSelect(entries, yesterdayIds, 4);

  if (selected.length < 2) {
    throw new Error("Need at least 2 players to start a game");
  }

  const playerIds = selected.map((e) => e.player_id);

  // Assign teams
  const teamAssignments = assignTeams(playerIds);

  // Create the game
  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      season_id: seasonId,
      date: today,
      status: "active",
    })
    .select()
    .single();

  if (gameError || !game) throw gameError ?? new Error("Failed to create game");

  // Create game_player records
  const gamePlayersToInsert = teamAssignments.map((ta) => {
    const entry = selected.find((e) => e.player_id === ta.playerId);
    const playerElo = entry?.player?.elo ?? 1000;
    return {
      game_id: game.id,
      player_id: ta.playerId,
      team: ta.team,
      elo_before: playerElo,
    };
  });

  const { data: gamePlayers, error: gpError } = await supabase
    .from("game_players")
    .insert(gamePlayersToInsert)
    .select("*, player:players(*)");

  if (gpError) throw gpError;

  // Update selected queue entries to 'playing'
  const entryIds = selected.map((e) => e.id);
  const { error: updateError } = await supabase
    .from("queue_entries")
    .update({ status: "playing" })
    .in("id", entryIds);

  if (updateError) throw updateError;

  return {
    ...(game as Game),
    game_players: (gamePlayers ?? []) as GamePlayer[],
  };
}

export async function submitResult(
  gameId: string,
  team1Goals: number,
  team2Goals: number,
  submittedBy: string
): Promise<void> {
  const { error } = await supabase.rpc("submit_result", {
    p_game_id: gameId,
    p_team1_goals: team1Goals,
    p_team2_goals: team2Goals,
    p_submitted_by: submittedBy,
  });

  if (error) throw error;
}

export async function rejectGame(
  gameId: string,
  rejectedBy: string
): Promise<void> {
  const { error } = await supabase.rpc("reject_game", {
    p_game_id: gameId,
    p_rejected_by: rejectedBy,
  });

  if (error) throw error;
}
