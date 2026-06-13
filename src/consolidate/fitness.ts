// Fitness composite d'un schéma de résolution (sélection darwinienne du champion).
// Fonction pure, déterministe, zéro LLM, zéro I/O.
//
// Phase 4 — ancrée sur les RÉSULTATS, pas sur la facilité : l'effort (tours, retours) est
// normalisé par un BUDGET propre à la sévérité du problème. Un problème majeur résolu dans son
// enveloppe attendue obtient une fitness pleine, au lieu d'être pénalisé pour avoir été dur.
// Ainsi on élit le schéma qui résout BIEN compte tenu de la difficulté, pas le plus trivial.
import type { ResolutionSchema, ResolutionOutcome, ProblemSeverity } from "./types.ts";

export const FITNESS_WEIGHTS = {
  turns: 0.35,
  backtracks: 0.25,
  toolErrors: 0.2,
  quality: 0.2,
} as const;

// Budget d'effort attendu par sévérité : en deçà, plein score ; au-delà, dégradation.
const SEVERITY_BUDGET: Record<ProblemSeverity, { turns: number; backtracks: number }> = {
  trivial: { turns: 1, backtracks: 0 },
  minor: { turns: 3, backtracks: 1 },
  major: { turns: 8, backtracks: 3 },
};

const OUTCOME_MULTIPLIER: Record<ResolutionOutcome, number> = {
  resolved: 1,
  partial: 0.6,
  unresolved: 0,
};

export interface FitnessBreakdown {
  turns: number;
  backtracks: number;
  toolErrors: number;
  quality: number;
  multiplier: number;
  total: number;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function clampQuality(q: number): number {
  return Math.min(100, Math.max(0, q));
}

export function fitnessBreakdown(
  rs: ResolutionSchema, sessionQuality: number, severity: ProblemSeverity = "minor",
): FitnessBreakdown {
  const turns = Math.max(1, rs.turns_to_resolve);
  const backtracks = Math.max(0, rs.backtracks);
  const toolErrors = Math.max(0, rs.tool_errors);
  const quality = clampQuality(sessionQuality);
  const budget = SEVERITY_BUDGET[severity];
  const parts = {
    // effort relatif au budget de difficulté : plein score si dans l'enveloppe attendue
    turns: FITNESS_WEIGHTS.turns * Math.min(1, budget.turns / turns),
    backtracks: FITNESS_WEIGHTS.backtracks * Math.min(1, (budget.backtracks + 1) / (backtracks + 1)),
    toolErrors: FITNESS_WEIGHTS.toolErrors * (1 / (toolErrors + 1)),
    quality: FITNESS_WEIGHTS.quality * (quality / 100),
  };
  const multiplier = OUTCOME_MULTIPLIER[rs.outcome];
  const base = parts.turns + parts.backtracks + parts.toolErrors + parts.quality;
  return {
    turns: round4(parts.turns),
    backtracks: round4(parts.backtracks),
    toolErrors: round4(parts.toolErrors),
    quality: round4(parts.quality),
    multiplier,
    total: round4(base * multiplier),
  };
}

export function computeFitness(
  rs: ResolutionSchema, sessionQuality: number, severity: ProblemSeverity = "minor",
): number {
  return fitnessBreakdown(rs, sessionQuality, severity).total;
}
