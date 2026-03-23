# FIFA Team Randomizer — Design Spec

## Overview

Map the ELO-based star rating (1-5) to real EA FC 26 FIFA teams. When a game starts and teams are shuffled, each team can optionally get a random FIFA team assigned based on their star tier, revealed with a slot-machine animation.

## Behavior

### Default Mode (no randomizer)
- Star rating displays as today (1-5 stars from ELO)
- Players pick their own FIFA team in-game, using the star rating as guidance

### Random Team Mode (opt-in toggle)
- Toggle on the ActiveGame screen: "Random Team" button
- When enabled, each side gets a random FIFA team from their star tier
- Slot-machine reveal animation: team names cycle rapidly then settle on the final pick
- Displays assigned team name, league, and club badge below each team card
- Both teams get independently randomized — can re-roll by tapping again

## Star Tier Mapping

The app uses integer stars (1-5), FC 26 uses half-stars (0.5-5). Mapping:

| App Stars | FC 26 Stars | Team Count |
|-----------|-------------|------------|
| 5         | 5           | 8          |
| 4         | 4-4.5       | 43         |
| 3         | 3-3.5       | 110        |
| 2         | 2-2.5       | 375        |
| 1         | 0.5-1.5     | 125        |

## Data

- **Source:** 661 teams scraped from SoFIFA FC 26 database
- **Format:** Bundled JSON file at `lib/fc26-teams.json` (~25KB)
- **Fields per team:** name, league, ovr (0-99), stars (0.5-5.0)
- **No external API dependency** for team data — fully offline

## Logos

- **Source:** TheSportsDB free API (`searchteams.php?t={name}`)
- **Field:** `strBadge` returns a PNG URL for the club crest
- **Caching:** Cache logo URLs in-memory after first fetch per session
- **Fallback:** `ui-avatars.com` letter-based icon if API returns no match
- **No API key required** — free tier supports search by team name

## UI Changes

### ActiveGame Component
- Add "Random Team" toggle button below the VS divider
- When active, each TeamCard shows:
  - Club badge image (circular, below star rating)
  - Team name in bold
  - League name in smaller muted text
- Slot machine animation: 1.5s of rapid team name cycling, then ease-out to final selection

### New Components
- `FifaTeamReveal` — slot machine animation + display of assigned team
- `FifaTeamBadge` — logo image with fallback

### New Lib
- `lib/fifa-teams.ts` — `getRandomTeamForStars(appStars: number)` function, logo fetching + caching

## Files Changed

1. `lib/fc26-teams.json` — bundled team data (already created)
2. `lib/fifa-teams.ts` — new: team lookup, randomizer, logo fetching
3. `components/ActiveGame.tsx` — add Random Team toggle + reveal UI
4. `components/FifaTeamReveal.tsx` — new: slot machine animation
5. `components/FifaTeamBadge.tsx` — new: logo image with fallback
