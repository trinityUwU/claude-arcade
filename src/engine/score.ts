// Calcul du score global, du rang et des agrégats par catégorie.
import type { AchievementResult, ScoreSummary, TierName } from "../types.ts";

/** Points cumulés par tier atteint (Copper → Olympian). */
const TIER_POINTS = [10, 25, 60, 150, 400];

/** Paliers de rang global selon le score total. */
const RANK_BANDS: { rank: TierName; min: number }[] = [
  { rank: "Olympian", min: 8000 },
  { rank: "Diamond", min: 3000 },
  { rank: "Gold", min: 1000 },
  { rank: "Silver", min: 300 },
  { rank: "Copper", min: 0 },
];

export function pointsFor(tierIndex: number): number {
  let total = 0;
  for (let i = 0; i <= tierIndex && i < TIER_POINTS.length; i++) total += TIER_POINTS[i]!;
  return total;
}

function rankFor(points: number): TierName {
  for (const band of RANK_BANDS) {
    if (points >= band.min) return band.rank;
  }
  return "Copper";
}

export function computeScore(results: AchievementResult[]): ScoreSummary {
  const byCategory: ScoreSummary["byCategory"] = {};
  let totalPoints = 0, unlockedCount = 0;
  for (const r of results) {
    const cat = (byCategory[r.category] ??= { unlocked: 0, total: 0, points: 0 });
    cat.total++;
    const pts = pointsFor(r.tierIndex);
    cat.points += pts;
    totalPoints += pts;
    if (r.state === "unlocked") {
      cat.unlocked++;
      unlockedCount++;
    }
  }
  return {
    totalPoints, unlockedCount, totalCount: results.length,
    rank: rankFor(totalPoints), byCategory,
  };
}
