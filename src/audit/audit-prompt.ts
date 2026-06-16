// Prompt du verdict approfondi d'un fichier de config, jugé selon les normes Anthropic.
import type { ConfigKind } from "../config/types.ts";

const ROLE_HINT: Record<ConfigKind, string> = {
  instruction: "a global instruction file injected into EVERY session (context cost is permanent)",
  skill: "a Claude Code skill, loaded on demand by its description/trigger",
  command: "a slash command prompt template",
  setting: "a JSON settings file",
};

export function buildDeepAuditPrompt(relPath: string, kind: ConfigKind, content: string, rubric = ""): string {
  const rubricBlock = rubric
    ? ["=== SCORING RUBRIC (the project's native prompting standard — judge STRICTLY against this) ===", rubric, ""]
    : ["Judge it on: instruction clarity, XML/structure, English (the norm for Anthropic models),",
       "token economy (no bloat for its role), explicit triggers, and absence of contradictions.", ""];
  return [
    "Tu es un prompt engineer Claude Code senior. Tu audites un fichier de config selon les principes natifs ci-dessous.",
    `Le fichier \`${relPath}\` est ${ROLE_HINT[kind]}.`,
    "",
    ...rubricBlock,
    "Réponds en FRANÇAIS, format markdown. Structure EXACTE :",
    "1. Première ligne, rien d'autre : `VERDICT: <excellent|solid|mediocre|overloaded|thin>`",
    "2. Puis l'analyse en markdown : `## Forces`, `## Problèmes`, `## Piste de réécriture` (concrète, actionnable).",
    "Sois dense et direct, pas de remplissage.",
    "",
    "=== CONTENU DU FICHIER ===",
    content.slice(0, 24_000),
  ].join("\n");
}
