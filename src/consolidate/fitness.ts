// Fitness composite d'un schéma de résolution (sélection darwinienne du champion).
// Fonction pure, déterministe, zéro LLM, zéro I/O.
import type { ResolutionSchema, ResolutionOutcome } from "./types.ts";

export const FITNESS_WEIGHTS = {
  turns: 0.35,
  backtracks: 0.25,
  toolErrors: 0.2,
  quality: 0.2,
} as const;

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

export function fitnessBreakdown(rs: ResolutionSchema, sessionQuality: number): FitnessBreakdown {
  const turns = Math.max(1, rs.turns_to_resolve);
  const backtracks = Math.max(0, rs.backtracks);
  const toolErrors = Math.max(0, rs.tool_errors);
  const quality = clampQuality(sessionQuality);
  const parts = {
    turns: FITNESS_WEIGHTS.turns * (1 / turns),
    backtracks: FITNESS_WEIGHTS.backtracks * (1 / (backtracks + 1)),
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

export function computeFitness(rs: ResolutionSchema, sessionQuality: number): number {
  return fitnessBreakdown(rs, sessionQuality).total;
}
