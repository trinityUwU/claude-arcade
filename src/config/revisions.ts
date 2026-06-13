// Mesure d'impact des écritures appliquées : qualité moyenne des sessions AVANT vs APRÈS une
// révision. Signal grossier (global, pas par skill) → flag régression, revert proposé (jamais auto).
import type { SessionSummary } from "../consolidate/types.ts";
import type { Proposal, ProposalKind } from "./types.ts";

const WINDOW_MS = 14 * 24 * 3600_000; // fenêtre de 14 jours de chaque côté de l'application
const MARGIN = 5;                     // baisse de qualité (points) à partir de laquelle on flague
const MIN_SAMPLE = 3;                 // pas de verdict sous 3 sessions de chaque côté

export interface RevisionImpact {
  id: string;
  title: string;
  kind: ProposalKind;
  commitHash?: string;
  appliedAt: number;
  before: number | null;
  after: number | null;
  sampleBefore: number;
  sampleAfter: number;
  regression: boolean;
}

function avgQuality(summaries: SessionSummary[], from: number, to: number): { avg: number; n: number } {
  const xs = summaries
    .filter((s) => { const t = s.endTs || s.summarizedAt; return t >= from && t < to; })
    .map((s) => s.quality_score);
  if (!xs.length) return { avg: 0, n: 0 };
  return { avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), n: xs.length };
}

export function assessRevisions(journal: Proposal[], summaries: SessionSummary[]): RevisionImpact[] {
  return journal
    .filter((p) => p.status === "applied" && p.appliedAt)
    .map((p) => {
      const t = p.appliedAt as number;
      const b = avgQuality(summaries, t - WINDOW_MS, t);
      const a = avgQuality(summaries, t, t + WINDOW_MS);
      const measurable = b.n >= MIN_SAMPLE && a.n >= MIN_SAMPLE;
      return {
        id: p.id, title: p.title, kind: p.kind, commitHash: p.commitHash, appliedAt: t,
        before: b.n ? b.avg : null, after: a.n ? a.avg : null,
        sampleBefore: b.n, sampleAfter: a.n,
        regression: measurable && a.avg < b.avg - MARGIN,
      };
    })
    .sort((x, y) => y.appliedAt - x.appliedAt);
}
