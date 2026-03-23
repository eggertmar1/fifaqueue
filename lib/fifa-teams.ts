import teamsData from "./fc26-teams.json";

export interface FifaTeam {
  name: string;
  league: string;
  ovr: number;
  stars: number;
}

const allTeams: FifaTeam[] = teamsData as FifaTeam[];

// Map app star rating (1-5 integer) to FC 26 star ranges
function getFC26StarRange(appStars: number): [number, number] {
  switch (appStars) {
    case 5:
      return [5, 5];
    case 4:
      return [4, 4.5];
    case 3:
      return [3, 3.5];
    case 2:
      return [2, 2.5];
    case 1:
    default:
      return [0.5, 1.5];
  }
}

export function getTeamsForStars(appStars: number): FifaTeam[] {
  const [min, max] = getFC26StarRange(appStars);
  return allTeams.filter((t) => t.stars >= min && t.stars <= max);
}

export function getRandomTeamForStars(appStars: number): FifaTeam {
  const pool = getTeamsForStars(appStars);
  if (pool.length === 0) {
    return { name: "Unknown", league: "Unknown", ovr: 50, stars: 1 };
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Logo fetching via TheSportsDB (free, no API key)
const logoCache = new Map<string, string | null>();

export async function getTeamLogoUrl(
  teamName: string
): Promise<string | null> {
  if (logoCache.has(teamName)) {
    return logoCache.get(teamName) ?? null;
  }

  try {
    const res = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`
    );
    const data = await res.json();
    const badge = data?.teams?.[0]?.strBadge ?? null;
    logoCache.set(teamName, badge);
    return badge;
  } catch {
    logoCache.set(teamName, null);
    return null;
  }
}

export function getFallbackLogoUrl(teamName: string): string {
  const initials = teamName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .substring(0, 3);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1E1E1E&color=00D26A&bold=true&size=64`;
}
