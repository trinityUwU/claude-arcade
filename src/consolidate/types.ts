// Types de la couche de consolidation (résumés de session).

/** Champs produits par le `claude -p` de résumé (cf. summary-prompt.ts). */
export interface SummaryFields {
  project: string;
  topic: string;
  wins: string[];
  errors_claude: string[];
  errors_chris: string[];
  decisions: string[];
  quality_score: number;
  links_hint: string[];
}

/** Résumé persisté d'une session, avec métadonnées de traçabilité. */
export interface SessionSummary extends SummaryFields {
  sessionId: string;
  file: string;
  fingerprint: string;
  model: string;
  summarizedAt: number;
  schemaVersion: number;
}

/** Index des sessions déjà résumées (idempotence + zéro-perte). */
export interface ConsolidationIndex {
  schemaVersion: number;
  lastRun: number;
  processed: Record<string, { fingerprint: string; at: number }>;
}

export interface ConsolidationRun {
  scanned: number;
  pending: number;
  summarized: number;
  failed: number;
  skipped: number;
  quota: number;
  ms: number;
}
