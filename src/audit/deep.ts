// Verdict approfondi d'un fichier via claude -p en STREAMING (action explicite → seule dépense
// de tokens). Modèle sonnet. Runner injectable pour tester sans cramer de tokens.
import { join } from "node:path";
import { scanConfig } from "../config/scan.ts";
import { configRoot } from "../config/paths.ts";
import { buildDeepAuditPrompt } from "./audit-prompt.ts";
import { loadPromptRubric } from "./pe-rubric.ts";
import { saveDeepAudit } from "./deep-store.ts";
import { streamClaude, type StreamRunner } from "./stream-claude.ts";
import { logger } from "../logger.ts";
import type { DeepAudit, AuditGrade } from "./types.ts";

const GRADES: readonly AuditGrade[] = ["excellent", "solid", "mediocre", "overloaded", "thin"];

/** Sépare la 1ʳᵉ ligne `VERDICT: x` du reste markdown. Verdict par défaut mediocre. */
export function parseStreamed(relPath: string, text: string, costUsd: number): DeepAudit {
  const m = /^\s*VERDICT:\s*(\w+)/i.exec(text);
  const raw = m?.[1]?.toLowerCase() ?? "";
  const verdict = (GRADES as readonly string[]).includes(raw) ? (raw as AuditGrade) : "mediocre";
  const markdown = m ? text.slice(text.indexOf(m[0]) + m[0].length).trim() : text.trim();
  return { relPath, verdict, markdown, costUsd };
}

/**
 * Audit profond streamé d'un fichier whitelisté. `onText` reçoit le texte live.
 * Retourne null si chemin refusé. `runner` injectable (tests sans tokens).
 */
export async function deepAuditFile(
  relPath: string, onText: (chunk: string) => void = () => {}, runner: StreamRunner = streamClaude,
): Promise<DeepAudit | null> {
  try {
    const tree = await scanConfig();
    const entry = tree.entries.find((e) => e.relPath === relPath);
    if (!entry) return null;  // garde whitelist : refuse tout hors scan
    const content = await Bun.file(join(configRoot(), relPath)).text();
    const rubric = await loadPromptRubric();
    const { text, costUsd } = await runner(buildDeepAuditPrompt(relPath, entry.kind, content, rubric), onText);
    const result = parseStreamed(relPath, text, costUsd);
    await saveDeepAudit(result);
    return result;
  } catch (err) {
    logger.error({ err, relPath }, "deepAuditFile failed");
    return null;
  }
}
