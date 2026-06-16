// Détection déterministe des anti-patterns de prompting, norme = nos `claude-prompting-principles.md`
// (distillés des best practices Anthropic). S'applique aux fichiers qui SONT des prompts.
import type { ConfigEntry } from "../config/types.ts";
import type { AuditFlag } from "./types.ts";

// Mots d'injonction qui, criés EN CAPS, déclenchent le sur-prompting (piège 4.6, principe §9).
const CAPS_INJUNCTION = /\b(NEVER|ALWAYS|ABSOLUTE(?:LY)?|CRITICAL|MANDATORY|MUST|FORBIDDEN|DO NOT)\b/g;
const NO_EXCEPTION = /\b(no exception|under no circumstances|without exception|sans aucune exception)\b/gi;
// Formulations négatives nues ("ne fais pas") — principe §3 : dire quoi faire, pas quoi ne pas faire.
const NEGATIVE = /\b(do not|don't|never|do NOT|ne (?:jamais|pas)|n'utilise (?:jamais|pas)|interdit)\b/gi;

function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function checkOverPrompting(content: string, flags: AuditFlag[]): void {
  const caps = count(content, CAPS_INJUNCTION);
  const noExc = count(content, NO_EXCEPTION);
  // Seuil : densité d'injonctions criées rapportée à la taille (≈ par 1000 caractères).
  const per1k = (caps / Math.max(content.length, 1)) * 1000;
  if (caps >= 8 && per1k > 1.2 || noExc >= 2) {
    flags.push({
      code: "over-prompting", severity: "bad",
      message: `Sur-prompting : ${caps} injonctions en CAPS${noExc ? ` + ${noExc}× "no exception"` : ""}. ` +
        "Dégrade le suivi sur 4.x — remplacer les ordres nus par des instructions + le pourquoi.",
    });
  }
}

function checkNegativeFraming(content: string, flags: AuditFlag[]): void {
  const neg = count(content, NEGATIVE);
  const per1k = (neg / Math.max(content.length, 1)) * 1000;
  if (neg >= 10 && per1k > 1.5) {
    flags.push({
      code: "negative-framing", severity: "warn",
      message: `${neg} formulations négatives ("ne pas / never"). Préférer dire quoi FAIRE + donner le pourquoi (principes §2/§3).`,
    });
  }
}

/** Anti-patterns de prompt sur les fichiers qui sont des prompts (instruction/skill/command). */
export function runPromptChecks(entry: ConfigEntry, content: string): AuditFlag[] {
  if (entry.kind === "setting") return [];
  const flags: AuditFlag[] = [];
  checkOverPrompting(content, flags);
  checkNegativeFraming(content, flags);
  return flags;
}
