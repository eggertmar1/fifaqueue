export function calculateElo(
  playerElo: number,
  opponentTeamElo: number,
  didWin: boolean,
  kFactor: number = 32
): number {
  const expected =
    1 / (1 + Math.pow(10, (opponentTeamElo - playerElo) / 400));
  const actual = didWin ? 1 : 0;
  return Math.round(playerElo + kFactor * (actual - expected));
}

export function getStarRating(
  teamAvgElo: number,
  _groupMaxElo: number
): number {
  // Absolute thresholds based on team average ELO
  // Starting ELO is 1000, so teams around 1000 get 3 stars (middle tier)
  if (teamAvgElo >= 1040) return 5;
  if (teamAvgElo >= 1020) return 4;
  if (teamAvgElo >= 990) return 3;
  if (teamAvgElo >= 960) return 2;
  return 1;
}
