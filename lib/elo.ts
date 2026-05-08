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
  // Half-step buckets in 15-ELO bands; 990-1004 (centered on starting ELO 1000) = 3 stars.
  if (teamAvgElo >= 1050) return 5;
  if (teamAvgElo >= 1035) return 4.5;
  if (teamAvgElo >= 1020) return 4;
  if (teamAvgElo >= 1005) return 3.5;
  if (teamAvgElo >= 990) return 3;
  if (teamAvgElo >= 975) return 2.5;
  if (teamAvgElo >= 960) return 2;
  if (teamAvgElo >= 945) return 1.5;
  return 1;
}
