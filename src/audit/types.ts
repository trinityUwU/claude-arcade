// Diagnostic de qualité de la config Claude Code (~/.claude).
// Détection déterministe de mauvais patterns + verdict approfondi optionnel (claude -p).
import type { ConfigKind } from "../config/types.ts";

export type AuditSeverity = "good" | "warn" | "bad";

/** Verdict synthétique d'une entrée. overloaded/thin sont des étiquettes structurelles fortes. */
export type AuditGrade = "excellent" | "solid" | "mediocre" | "overloaded" | "thin";

export interface AuditFlag {
  code: AuditCode;
  severity: AuditSeverity;
  message: string;          // FR, lisible directement dans l'UI
}

export type AuditCode =
  | "non-english"           // corpus majoritairement non-anglais (norme Anthropic = anglais)
  | "overloaded"            // trop de tokens pour son rôle (coût de contexte injecté)
  | "thin"                  // trop court / sous-détaillé pour être utile
  | "no-description"        // skill/command sans frontmatter description (mauvais routing)
  | "wall-of-text"          // aucune structure markdown sur un gros bloc
  | "no-trigger"            // skill sans déclencheur explicite
  | "over-prompting"        // injonctions agressives en caps / "no exception" (piège 4.6, principe §9)
  | "negative-framing";     // sur-densité de "do not / never" sans le pourquoi (principes §2/§3)

/** Une norme évaluée sur une entrée : ok=true si respectée, sinon message d'échec. */
export interface AuditCheck {
  code: AuditCode;
  label: string;            // libellé court pour le chip
  ok: boolean;
  severity: AuditSeverity;  // gravité si échec (sinon "good")
  message?: string;         // détail seulement si échec
}

export interface EntryAudit {
  relPath: string;
  kind: ConfigKind;
  name: string;
  bytes: number;
  estTokens: number;        // estimation grossière (bytes / 4)
  grade: AuditGrade;
  score: number;            // 0-100, déterministe
  flags: AuditFlag[];       // uniquement les échecs (rétro-compat)
  checks: AuditCheck[];     // checklist complète des normes applicables (vrai/faux)
  deep?: DeepAudit;         // verdict approfondi persisté, si déjà lancé
}

export interface AuditSummary {
  total: number;
  byGrade: Record<AuditGrade, number>;
  totalTokens: number;
  topIssues: Array<{ code: AuditCode; count: number }>;
}

export interface AuditReport {
  generatedAt: number;
  configRoot: string;
  summary: AuditSummary;
  entries: EntryAudit[];
}

/** Verdict approfondi d'un fichier via claude -p (action explicite, dépense de tokens). */
export interface DeepAudit {
  relPath: string;
  verdict: AuditGrade;
  strengths: string[];
  issues: string[];
  rewriteHint: string;      // piste de réécriture actionnable
}
