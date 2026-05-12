import teamsData from "./fc26-teams.json";

export interface FifaTeam {
  name: string;
  league: string;
  ovr: number;
  stars: number;
}

const allTeams: FifaTeam[] = teamsData as FifaTeam[];

export function getTeamsForStars(appStars: number): FifaTeam[] {
  // Exact-match by half-step: appStars 3.5 selects only FC 26 teams rated 3.5.
  return allTeams.filter((t) => Math.abs(t.stars - appStars) < 0.01);
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const teams: any[] = Array.isArray(data?.teams) ? data.teams : [];
    const wantedNorm = normalize(teamName);

    const soccerOnly = teams.filter(
      (t) => (t.strSport ?? "").toLowerCase() === "soccer"
    );
    const pool = soccerOnly.length > 0 ? soccerOnly : teams;

    const exact = pool.find((t) => normalize(t.strTeam ?? "") === wantedNorm);
    const alt = pool.find(
      (t) => normalize(t.strTeamAlternate ?? "") === wantedNorm
    );
    // Lenient: one normalized name fully contains the other (e.g. "fc barcelona" ↔ "barcelona")
    const lenient = pool.find((t) => {
      const candidate = normalize(t.strTeam ?? "");
      if (!candidate || candidate.length < 4) return false;
      return (
        candidate.includes(wantedNorm) || wantedNorm.includes(candidate)
      );
    });
    const matched = exact ?? alt ?? lenient ?? null;
    const badge = matched?.strBadge ?? null;

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
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=222629&color=7FD9A8&bold=true&size=64`;
}
