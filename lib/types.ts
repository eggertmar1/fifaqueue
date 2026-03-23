export interface Player {
  id: string;
  google_id: string;
  name: string;
  avatar_url: string | null;
  elo: number;
  is_admin: boolean;
  expo_push_token: string | null;
  created_at: string;
}

export interface Season {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  queue_open_override: boolean | null;
}

export interface QueueEntry {
  id: string;
  player_id: string;
  season_id: string;
  date: string;
  position: number;
  status: "registered" | "playing" | "played" | "waiting" | "done";
  games_today: number;
  joined_at: string;
  player?: Player;
}

export interface Game {
  id: string;
  season_id: string;
  date: string;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed";
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  team: 1 | 2;
  elo_before: number;
  elo_after: number | null;
  player?: Player;
}

export interface GameResult {
  id: string;
  game_id: string;
  team1_goals: number;
  team2_goals: number;
  submitted_by: string;
  submitted_at: string;
}

export interface EloHistory {
  id: string;
  player_id: string;
  game_id: string;
  elo_before: number;
  elo_after: number;
  delta: number;
  recorded_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  elo: number;
  wins: number;
  losses: number;
  winPct: number;
  streak: string;
  avgGoals: number;
}

export interface HeadToHead {
  opponent: Player;
  gamesAsTeammates: number;
  gamesAsOpponents: number;
  winsAgainst: number;
  lossesAgainst: number;
}
