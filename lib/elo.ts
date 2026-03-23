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
  groupMaxElo: number
): number {
  const ratio = teamAvgElo / groupMaxElo;
  if (ratio >= 0.95) return 5;
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.75) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}
