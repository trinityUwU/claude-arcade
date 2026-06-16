// Agrégation des drapeaux → score + grade synthétique d'une entrée.
import type { AuditFlag, AuditGrade } from "./types.ts";

const PENALTY: Record<AuditFlag["severity"], number> = { bad: 30, warn: 15, good: 0 };

export function scoreFromFlags(flags: AuditFlag[]): number {
  const lost = flags.reduce((s, f) => s + PENALTY[f.severity], 0);
  return Math.max(0, 100 - lost);
}

/** Étiquettes structurelles (surchargé/maigre) priment sur le score brut. */
export function gradeFromFlags(flags: AuditFlag[], score: number): AuditGrade {
  if (flags.some((f) => f.code === "overloaded")) return "overloaded";
  if (flags.some((f) => f.code === "thin")) return "thin";
  if (score >= 85) return "excellent";
  if (score >= 65) return "solid";
  return "mediocre";
}
