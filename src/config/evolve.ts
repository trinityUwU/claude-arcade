// Génération LLM du contenu (réécriture/création de skill) via claude -p isolé. Gate anti-bloat.
// Le générateur est injectable → testable sans dépense de tokens.
import { runIsolatedClaude, defaultModel } from "../consolidate/summarize.ts";
import { envelopeResult, extractJson } from "../consolidate/parse.ts";
import { buildPatchPrompt, buildCreatePrompt } from "./evolve-prompt.ts";
import { logger } from "../logger.ts";

const BLOAT_FACTOR = 1.25;  // un patch ne doit pas rallonger le skill de plus de 25 % (anti-bloat)
const TIMEOUT_MS = 120_000;

export type GenResult = { content: string } | { skip: string };
export type Generator = (prompt: string) => Promise<string>;

const defaultGen: Generator = (p) => runIsolatedClaude(p, defaultModel(), TIMEOUT_MS);

function parseContent(raw: string): string | null {
  const obj = extractJson(envelopeResult(raw)) as { content?: unknown } | null;
  return obj && typeof obj.content === "string" ? obj.content : null;
}

export async function generatePatch(
  skillName: string, current: string, principle: string, gen: Generator = defaultGen,
): Promise<GenResult> {
  try {
    const content = parseContent(await gen(buildPatchPrompt(skillName, current, principle)));
    if (!content || !content.trim()) return { skip: "génération vide ou illisible" };
    if (content.length > current.length * BLOAT_FACTOR) {
      return { skip: `anti-bloat : ${content.length} c. > ${Math.round(current.length * BLOAT_FACTOR)} c. autorisés` };
    }
    return { content };
  } catch (err) {
    logger.error({ err, skillName }, "generatePatch failed");
    return { skip: "erreur de génération" };
  }
}

export async function generateCreate(
  className: string, definition: string, projects: string[], gen: Generator = defaultGen,
): Promise<GenResult> {
  try {
    const content = parseContent(await gen(buildCreatePrompt(className, definition, projects)));
    if (!content || !content.includes("---")) return { skip: "création invalide (frontmatter absent)" };
    return { content };
  } catch (err) {
    logger.error({ err, className }, "generateCreate failed");
    return { skip: "erreur de génération" };
  }
}
