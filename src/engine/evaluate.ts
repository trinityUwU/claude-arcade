// Évaluation d'un achievement contre l'agrégat → état + tier + progression.
import type { Achievement, AchievementResult, Aggregate, AchievementState, TierName } from "../types.ts";

/** Index du tier le plus haut atteint (-1 si aucun). */
function tierReached(value: number, thresholds: number[]): number {
  let idx = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]!) idx = i;
  }
  return idx;
}

function deriveState(secret: boolean, value: number, tierIndex: number): AchievementState {
  if (tierIndex >= 0) return "unlocked";
  if (secret && value === 0) return "secret";
  return "discovered";
}

/** Progression 0–1 vers le prochain palier + seuil cible. */
function progressTo(value: number, tierIndex: number, thresholds: number[]): { progress: number; next: number | null } {
  const nextIdx = tierIndex + 1;
  if (nextIdx >= thresholds.length) return { progress: 1, next: null };
  const floor = tierIndex >= 0 ? thresholds[tierIndex]! : 0;
  const ceil = thresholds[nextIdx]!;
  const span = ceil - floor;
  const progress = span <= 0 ? 0 : Math.min(1, Math.max(0, (value - floor) / span));
  return { progress, next: ceil };
}

export function evaluate(a: Achievement, agg: Aggregate): AchievementResult {
  const value = agg[a.thresholdMetric] ?? 0;
  const thresholds = a.tiers.map((tier) => tier.threshold);
  const tierIndex = tierReached(value, thresholds);
  const state = deriveState(a.secret ?? false, value, tierIndex);
  const { progress, next } = progressTo(value, tierIndex, thresholds);
  const tierName: TierName | null = tierIndex >= 0 ? a.tiers[tierIndex]!.name : null;
  return {
    id: a.id, name: a.name, description: a.description, category: a.category,
    icon: a.icon, secret: a.secret ?? false, state, tierIndex, tierName,
    value, nextThreshold: next, progress, tiers: a.tiers,
  };
}
