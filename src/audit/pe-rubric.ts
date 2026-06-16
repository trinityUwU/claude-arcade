// Charge nos principes de prompting natifs (`/prompt-architect`) comme RUBRIQUE de jugement.
// C'est la norme du projet : distillée des best practices officielles Anthropic.
// Single source of truth — on lit le fichier du skill, on ne le réimplémente jamais.
import { join } from "node:path";
import { configRoot } from "../config/paths.ts";
import { logger } from "../logger.ts";

const REL = "skills/prompt-architect/references/claude-prompting-principles.md";
const MAX_CHARS = 4_000;  // borne d'injection : cœur des principes seulement (latence + coût)
let cache: string | null = null;

/** Texte de la rubrique, ou "" si le skill prompt-architect est absent (autre utilisateur). */
export async function loadPromptRubric(): Promise<string> {
  if (cache !== null) return cache;
  try {
    const f = Bun.file(join(configRoot(), REL));
    cache = (await f.exists()) ? (await f.text()).slice(0, MAX_CHARS) : "";
  } catch (err) {
    logger.error({ err }, "loadPromptRubric failed");
    cache = "";
  }
  return cache;
}
