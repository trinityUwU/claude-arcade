// Règles déterministes de détection de mauvais patterns sur une entrée de config.
// Spécialisé Claude Code / modèles Anthropic : seuils pensés pour le coût de contexte injecté.
import type { ConfigEntry, ConfigKind } from "../config/types.ts";
import type { AuditFlag } from "./types.ts";
import { detectEnglish } from "./lang.ts";
import { runPromptChecks } from "./prompt-quality.ts";

// Seuils d'octets au-delà desquels le rôle devient « surchargé » (coût de contexte).
// CLAUDE.md + rules sont injectés CHAQUE session → tolérance plus basse.
const OVERLOAD_BYTES: Record<ConfigKind, number> = {
  instruction: 9_000,
  skill: 18_000,
  command: 6_000,
  setting: 12_000,
};
// En dessous, l'entrée est trop maigre pour porter une vraie valeur.
const THIN_BYTES: Record<ConfigKind, number> = {
  instruction: 160,
  skill: 420,
  command: 200,
  setting: 0,
};

export function estTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

function checkSize(entry: ConfigEntry, flags: AuditFlag[]): void {
  const over = OVERLOAD_BYTES[entry.kind];
  if (entry.bytes > over) {
    flags.push({
      code: "overloaded", severity: "bad",
      message: `Surchargé : ~${estTokens(entry.bytes)} tokens injectés (seuil ${estTokens(over)}). Densifier ou découper.`,
    });
  }
  const thin = THIN_BYTES[entry.kind];
  if (thin > 0 && entry.bytes < thin) {
    flags.push({
      code: "thin", severity: "warn",
      message: `Sous-détaillé : ${entry.bytes} c. seulement, trop maigre pour guider le modèle.`,
    });
  }
}

function checkMetadata(entry: ConfigEntry, content: string, flags: AuditFlag[]): void {
  if ((entry.kind === "skill" || entry.kind === "command") && !entry.description?.trim()) {
    flags.push({
      code: "no-description", severity: "bad",
      message: "Pas de description dans le frontmatter → routing/déclenchement aveugle.",
    });
  }
  if (entry.kind === "skill" && !/trigger|when to use|use when|triggers on|déclenche/i.test(content)) {
    flags.push({
      code: "no-trigger", severity: "warn",
      message: "Aucun déclencheur explicite : le modèle devine quand activer le skill.",
    });
  }
}

function checkStructure(entry: ConfigEntry, content: string, flags: AuditFlag[]): void {
  const hasHeading = /^#{1,6}\s/m.test(content) || /<\w+>/.test(content);
  if (entry.bytes > 1_500 && !hasHeading) {
    flags.push({
      code: "wall-of-text", severity: "warn",
      message: "Bloc massif sans structure (titres/XML) : difficile à parser pour le modèle.",
    });
  }
}

function checkLanguage(entry: ConfigEntry, content: string, flags: AuditFlag[]): void {
  if (entry.kind === "setting") return;
  const v = detectEnglish(content);
  if (!v.english) {
    flags.push({
      code: "non-english", severity: "warn",
      message: `Rédigé en non-anglais (${v.otherHits} marqueurs). Norme Anthropic : l'anglais maximise le suivi d'instructions.`,
    });
  }
}

/** Applique toutes les règles déterministes et retourne les drapeaux levés. */
export function runHeuristics(entry: ConfigEntry, content: string): AuditFlag[] {
  const flags: AuditFlag[] = [];
  checkSize(entry, flags);
  checkMetadata(entry, content, flags);
  checkStructure(entry, content, flags);
  checkLanguage(entry, content, flags);
  flags.push(...runPromptChecks(entry, content));
  return flags;
}
